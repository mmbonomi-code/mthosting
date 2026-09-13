/**
 * Prueba de punta a punta de lo que hace una persona con una marca del
 * calendario (lib/ical/confirmar.ts), contra la base DEV.
 *
 * Verifica lo que importa: que "sigue en pie" no toca la reserva, que aplicar
 * fechas nuevas mueve la limpieza, y que confirmar la cancelación cancela la
 * reserva, su limpieza y sus eventos.
 *
 * Trabaja con UNA reserva inventada, con un código que no existe en Airbnb y
 * fechas de 2030, y al terminar borra SOLO lo que creó (ver el aviso de
 * scripts/e2e-ical.test.ts: una limpieza que borraba de más ya se llevó
 * puestos datos reales).
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { generarLimpiezas } from "../lib/limpiezas/generar";
import {
  confirmarCambioEnBase,
  descartarCambioEnBase,
  marcarRetenidasEnBase,
} from "../lib/ical/confirmar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CODIGO = "HMPRUEBACAL";
const CODIGO_REEMPLAZO = "HMPRUEBACA2";
const HOY = "2030-01-01";

describe.skipIf(!url || !clave)("marcas del calendario (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  let reservaId: string | null = null;
  let reemplazoId: string | null = null;

  afterAll(async () => {
    const ids = [reservaId, reemplazoId].filter((id): id is string => id !== null);
    if (ids.length === 0) return;
    // El orden importa: todo apunta a la reserva.
    for (const tabla of ["cambios_calendario", "limpiezas", "eventos_estadia"] as const) {
      const { error } = await s.from(tabla).delete().in("reserva_id", ids);
      expect(error, `no se pudieron borrar ${tabla} de la prueba`).toBeNull();
    }
    const { error } = await s.from("reservas").delete().in("id", ids);
    expect(error, "no se pudieron borrar las reservas de la prueba").toBeNull();
  });

  async function limpiezaDeSalida() {
    const { data } = await s
      .from("limpiezas")
      .select("fecha, estado")
      .eq("reserva_id", reservaId!)
      .eq("rol_reserva", "salida")
      .single();
    return data!;
  }

  async function pendiente(tipo: "posible_cancelacion" | "cambio_fechas") {
    const { data } = await s
      .from("cambios_calendario")
      .select("id")
      .eq("reserva_id", reservaId!)
      .eq("tipo", tipo)
      .eq("estado", "pendiente")
      .single();
    return data!.id;
  }

  it("descartar, aplicar fechas y confirmar la cancelación", async () => {
    const { data: previas } = await s
      .from("reservas")
      .select("id")
      .in("codigo_reserva", [CODIGO, CODIGO_REEMPLAZO]);
    expect(previas, "ya existen las reservas de prueba: quedó sucia una corrida anterior").toEqual([]);

    const { data: depto } = await s
      .from("departamentos")
      .select("id")
      .eq("activo", true)
      .limit(1)
      .single();

    const { data: creada, error } = await s
      .from("reservas")
      .insert({
        codigo_reserva: CODIGO,
        canal: "airbnb",
        origen: "ical",
        datos_completos: false,
        depto_id: depto!.id,
        fecha_checkin: "2030-03-10",
        fecha_checkout: "2030-03-13",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    reservaId = creada!.id;
    await generarLimpiezas(s, [CODIGO], HOY);
    expect((await limpiezaDeSalida()).fecha).toBe("2030-03-13");

    // 1. Lo retenido por el freno se marca a mano, y "sigue en pie" no toca nada.
    const marcadas = await marcarRetenidasEnBase(s, [reservaId]);
    expect(marcadas).toEqual({ ok: true, marcadas: 1 });
    // Marcar dos veces no duplica.
    expect(await marcarRetenidasEnBase(s, [reservaId])).toEqual({ ok: true, marcadas: 0 });

    const descarte = await descartarCambioEnBase(s, await pendiente("posible_cancelacion"), null);
    expect(descarte).toMatchObject({ ok: true });
    const { data: tras } = await s.from("reservas").select("cancelada").eq("id", reservaId).single();
    expect(tras!.cancelada).toBe(false);
    expect((await limpiezaDeSalida()).estado).not.toBe("cancelada");

    // 2. Aplicar fechas nuevas mueve la reserva y su limpieza.
    await s.from("cambios_calendario").insert({
      reserva_id: reservaId,
      tipo: "cambio_fechas",
      firma: "prueba",
      calendario_checkin: "2030-03-11",
      calendario_checkout: "2030-03-14",
    });
    const fechas = await confirmarCambioEnBase(s, await pendiente("cambio_fechas"), null, HOY);
    expect(fechas).toMatchObject({ ok: true });
    const { data: movida } = await s
      .from("reservas")
      .select("fecha_checkin, fecha_checkout, noches")
      .eq("id", reservaId)
      .single();
    expect(movida).toEqual({ fecha_checkin: "2030-03-11", fecha_checkout: "2030-03-14", noches: 3 });
    expect((await limpiezaDeSalida()).fecha).toBe("2030-03-14");

    // 3. Airbnb la cancela y vuelve a alquilar las mismas fechas (BORGES 2,
    //    13/09/2026): la reserva nueva nace sin limpieza, porque el día lo
    //    ocupa la de la vieja.
    const { data: nueva } = await s
      .from("reservas")
      .insert({
        codigo_reserva: CODIGO_REEMPLAZO,
        canal: "airbnb",
        origen: "ical",
        datos_completos: false,
        depto_id: depto!.id,
        fecha_checkin: "2030-03-12",
        fecha_checkout: "2030-03-14",
      })
      .select("id")
      .single();
    reemplazoId = nueva!.id;
    await generarLimpiezas(s, [CODIGO_REEMPLAZO], HOY);
    const { count: antes } = await s
      .from("limpiezas")
      .select("id", { count: "exact", head: true })
      .eq("reserva_id", reemplazoId)
      .eq("rol_reserva", "salida");
    expect(antes).toBe(0);

    // 4. Confirmar la cancelación cancela reserva, limpieza y eventos.
    await marcarRetenidasEnBase(s, [reservaId]);
    const cancelacion = await confirmarCambioEnBase(s, await pendiente("posible_cancelacion"), null, HOY);
    expect(cancelacion).toMatchObject({ ok: true });

    const { data: final } = await s.from("reservas").select("cancelada").eq("id", reservaId).single();
    expect(final!.cancelada).toBe(true);
    expect((await limpiezaDeSalida()).estado).toBe("cancelada");
    const { data: eventos } = await s.from("eventos_estadia").select("estado").eq("reserva_id", reservaId);
    expect(eventos!.length).toBe(2);
    expect(eventos!.every((e) => e.estado === "cancelado")).toBe(true);

    // Y el día liberado pasa a la reserva que la reemplazó.
    const { data: delReemplazo } = await s
      .from("limpiezas")
      .select("fecha, estado")
      .eq("reserva_id", reemplazoId)
      .eq("rol_reserva", "salida")
      .single();
    expect(delReemplazo).toEqual({ fecha: "2030-03-14", estado: "pendiente" });

    // Y una marca ya resuelta no se resuelve dos veces.
    const { data: confirmada } = await s
      .from("cambios_calendario")
      .select("id")
      .eq("reserva_id", reservaId)
      .eq("tipo", "posible_cancelacion")
      .eq("estado", "confirmado")
      .single();
    expect(await confirmarCambioEnBase(s, confirmada!.id, null, HOY)).toEqual({
      error: "Esta marca ya estaba resuelta.",
    });
  });
});
