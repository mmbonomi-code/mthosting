/**
 * Prueba de punta a punta de la sincronización iCal contra la base DEV,
 * con el archivo real de Airbnb servido desde un servidor local.
 *
 * Verifica lo que importa: que descubra reservas nuevas, que NO toque las
 * que ya existen, que los bloqueos no se conviertan en reservas y que cada
 * reserva descubierta se lleve su limpieza tentativa.
 *
 * ⚠️ CUIDADO AL TOCAR LA LIMPIEZA DE ESTA PRUEBA.
 *
 * El archivo de ejemplo es un export REAL, así que sus códigos de reserva son
 * códigos que también están en la base de verdad. La limpieza borraba por
 * código, sin distinguir: se llevó puestas 12 limpiezas de reservas reales que
 * la prueba nunca creó (13/08/2026). Desde entonces la prueba anota qué creó
 * ella y borra SOLO eso.
 *
 * Además, borrar una reserva exige borrar antes sus eventos de estadía y sus
 * limpiezas, o la baja falla por clave foránea. Fallaba en silencio, las
 * reservas quedaban en la base y la corrida siguiente daba error porque ya
 * existían. Ahora cada baja verifica su error.
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
  let syncOriginal: string | null = null;
  const codigosDelArchivo = parsearICal(ICS).reservas.map((r) => r.codigo!);
  /** Lo que creó ESTA corrida. Es lo único que se puede borrar. */
  const creadasPorLaPrueba: string[] = [];
  const bloqueosCreados: string[] = [];

  afterAll(async () => {
    if (creadasPorLaPrueba.length > 0) {
      const { data: reservas } = await s
        .from("reservas")
        .select("id")
        .in("codigo_reserva", creadasPorLaPrueba);
      const ids = (reservas ?? []).map((r) => r.id);

      if (ids.length > 0) {
        // El orden importa: las limpiezas y los eventos apuntan a la reserva.
        for (const tabla of ["limpiezas", "eventos_estadia"] as const) {
          const { error } = await s.from(tabla).delete().in("reserva_id", ids);
          // Se grita: si la baja falla, la corrida siguiente arranca sucia y
          // el error aparece lejos de la causa.
          expect(error, `no se pudieron borrar ${tabla} de la prueba`).toBeNull();
        }
        const { error } = await s.from("reservas").delete().in("id", ids);
        expect(error, "no se pudieron borrar las reservas de la prueba").toBeNull();
      }
    }

    if (bloqueosCreados.length > 0) {
      await s.from("bloqueos").delete().in("id", bloqueosCreados);
    }
    if (deptoId) {
      await s
        .from("departamentos")
        .update({ ical_url: icalOriginal, ical_ultima_sync: syncOriginal })
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
      .select("id, codigo, ical_url, ical_ultima_sync")
      .eq("activo", true)
      .limit(1)
      .single();
    deptoId = depto!.id;
    icalOriginal = depto!.ical_url;
    syncOriginal = depto!.ical_ultima_sync;
    await s
      .from("departamentos")
      .update({ ical_url: `http://127.0.0.1:${puerto}/calendario.ics` })
      .eq("id", deptoId);

    // Cuántas de esas reservas ya están en la base. Las que ya estaban son de
    // la operación real: la prueba no las creó y no las va a borrar.
    const { data: previas } = await s
      .from("reservas")
      .select("codigo_reserva, origen, datos_completos")
      .in("codigo_reserva", codigosDelArchivo);
    const yaExistian = new Set((previas ?? []).map((r) => r.codigo_reserva));
    creadasPorLaPrueba.push(
      ...codigosDelArchivo.filter((c) => !yaExistian.has(c)),
    );
    console.log(
      `el calendario trae ${codigosDelArchivo.length} reservas; ${yaExistian.size} ya estaban`,
    );

    // Los bloqueos que ya había, para no llevarse puestos los de verdad.
    const { data: bloqueosPrevios } = await s
      .from("bloqueos")
      .select("id")
      .eq("depto_id", deptoId);
    const bloqueosDeAntes = new Set((bloqueosPrevios ?? []).map((b) => b.id));

    const resumen = await sincronizarICal(s, deptoId);

    const { data: bloqueosAhora } = await s
      .from("bloqueos")
      .select("id")
      .eq("depto_id", deptoId);
    bloqueosCreados.push(
      ...(bloqueosAhora ?? []).map((b) => b.id).filter((id) => !bloqueosDeAntes.has(id)),
    );
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
    expect(resumen.reservasNuevas).toBe(creadasPorLaPrueba.length);
    // El archivo trae 3 bloqueos, que van a `bloqueos` y no a `reservas`.
    // Se cuentan los que aparecieron, no un número fijo: el departamento
    // prestado puede tener bloqueos suyos de antes.
    expect(bloqueosCreados.length).toBe(3);

    // La prueba no sirve de nada si el archivo ya está entero en la base.
    expect(creadasPorLaPrueba.length).toBeGreaterThan(0);

    // Las nuevas quedan marcadas como tentativas, con los 4 dígitos guardados.
    const { data: creadas } = await s
      .from("reservas")
      .select("codigo_reserva, origen, datos_completos, depto_id, raw")
      .in("codigo_reserva", creadasPorLaPrueba);
    expect(creadas!.length).toBe(resumen.reservasNuevas);
    for (const r of creadas!) {
      expect(r.origen).toBe("ical");
      expect(r.datos_completos).toBe(false);
      expect(r.depto_id).toBe(deptoId);
      expect((r.raw as { telefono_ultimos_4?: string }).telefono_ultimos_4).toMatch(/^\d{4}$/);
    }
    console.log(`  ej: ${creadas![0].codigo_reserva}, últimos 4: ${(creadas![0].raw as { telefono_ultimos_4?: string }).telefono_ultimos_4}`);

    // Y cada una se llevó su limpieza tentativa.
    const { data: idsCreadas } = await s
      .from("reservas")
      .select("id")
      .in("codigo_reserva", creadasPorLaPrueba);
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
