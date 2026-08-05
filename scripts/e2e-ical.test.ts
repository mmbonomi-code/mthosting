/**
 * Prueba de punta a punta de la sincronización iCal contra la base DEV,
 * con el archivo real de Airbnb servido desde un servidor local.
 *
 * Verifica lo que importa: que descubra reservas nuevas, que NO toque las
 * que ya existen, que los bloqueos no se conviertan en reservas y que cada
 * reserva descubierta se lleve su limpieza tentativa.
 */
import { readFileSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { parsearICal } from "../lib/ical/parser";
import { sincronizarICal } from "../lib/ical/sincronizar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ICS = readFileSync("ejemplos/ejemplo-airbnb.ics", "utf8");

describe.skipIf(!url || !clave)("sincronización iCal (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  let servidor: Server;
  let deptoId: string;
  let icalOriginal: string | null = null;
  const codigosDelArchivo = parsearICal(ICS).reservas.map((r) => r.codigo!);

  afterAll(async () => {
    // Se borra todo lo que creó la prueba y se deja el depto como estaba.
    await s.from("limpiezas").delete().in(
      "reserva_id",
      (
        await s.from("reservas").select("id").in("codigo_reserva", codigosDelArchivo)
      ).data?.map((r) => r.id) ?? [],
    );
    await s.from("reservas").delete().eq("origen", "ical").in("codigo_reserva", codigosDelArchivo);
    if (deptoId) {
      await s.from("bloqueos").delete().eq("depto_id", deptoId).eq("notas", "Bloqueo del calendario de Airbnb");
      await s
        .from("departamentos")
        .update({ ical_url: icalOriginal, ical_ultima_sync: null })
        .eq("id", deptoId);
    }
    servidor?.close();
  });

  it("descubre las reservas del calendario, respeta las que ya existen y genera sus limpiezas", async () => {
    // Un servidor local que sirve el .ics real, como haría Airbnb.
    servidor = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/calendar" });
      res.end(ICS);
    });
    await new Promise<void>((listo) => servidor.listen(0, listo));
    const puerto = (servidor.address() as { port: number }).port;

    // Se le presta el calendario a un departamento activo real.
    const { data: depto } = await s
      .from("departamentos")
      .select("id, codigo, ical_url")
      .eq("activo", true)
      .limit(1)
      .single();
    deptoId = depto!.id;
    icalOriginal = depto!.ical_url;
    await s
      .from("departamentos")
      .update({ ical_url: `http://127.0.0.1:${puerto}/calendario.ics` })
      .eq("id", deptoId);

    // Cuántas de esas reservas ya están en la base por el CSV.
    const { data: previas } = await s
      .from("reservas")
      .select("codigo_reserva, origen, datos_completos")
      .in("codigo_reserva", codigosDelArchivo);
    const yaExistian = new Set((previas ?? []).map((r) => r.codigo_reserva));
    console.log(
      `el calendario trae ${codigosDelArchivo.length} reservas; ${yaExistian.size} ya estaban por el CSV`,
    );

    const resumen = await sincronizarICal(s, deptoId);
    console.log("resumen:", {
      departamentos: resumen.departamentos,
      nuevas: resumen.reservasNuevas,
      existentes: resumen.reservasExistentes,
      bloqueos: resumen.bloqueosNuevos,
      limpiezas: resumen.limpiezasGeneradas,
      avisos: resumen.avisos.length,
    });

    expect(resumen.departamentos).toBe(1);
    expect(resumen.reservasExistentes).toBe(yaExistian.size);
    expect(resumen.reservasNuevas).toBe(codigosDelArchivo.length - yaExistian.size);
    // Los 3 bloqueos del archivo van a `bloqueos`, no a `reservas`.
    expect(resumen.bloqueosNuevos).toBe(3);

    // Las nuevas quedan marcadas como tentativas, con los 4 dígitos guardados.
    const { data: creadas } = await s
      .from("reservas")
      .select("codigo_reserva, origen, datos_completos, depto_id, raw")
      .eq("origen", "ical")
      .in("codigo_reserva", codigosDelArchivo);
    expect(creadas!.length).toBe(resumen.reservasNuevas);
    for (const r of creadas!) {
      expect(r.datos_completos).toBe(false);
      expect(r.depto_id).toBe(deptoId);
      expect((r.raw as { telefono_ultimos_4?: string }).telefono_ultimos_4).toMatch(/^\d{4}$/);
    }
    console.log(`  ej: ${creadas![0].codigo_reserva}, últimos 4: ${(creadas![0].raw as { telefono_ultimos_4?: string }).telefono_ultimos_4}`);

    // Y cada una se llevó su limpieza tentativa.
    const { data: idsCreadas } = await s
      .from("reservas")
      .select("id")
      .eq("origen", "ical")
      .in("codigo_reserva", codigosDelArchivo);
    const { count: conLimpieza } = await s
      .from("limpiezas")
      .select("id", { count: "exact", head: true })
      .in("reserva_id", (idsCreadas ?? []).map((r) => r.id));
    console.log(`limpiezas generadas para las nuevas: ${conLimpieza}`);
    expect(conLimpieza).toBeGreaterThan(0);

    // Sincronizar de nuevo no duplica nada.
    const segunda = await sincronizarICal(s, deptoId);
    console.log("2ª sincronización:", {
      nuevas: segunda.reservasNuevas,
      existentes: segunda.reservasExistentes,
      bloqueos: segunda.bloqueosNuevos,
    });
    expect(segunda.reservasNuevas).toBe(0);
    expect(segunda.bloqueosNuevos).toBe(0);
    expect(segunda.reservasExistentes).toBe(codigosDelArchivo.length);
  }, 180000);
});
