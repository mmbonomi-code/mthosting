/**
 * Prueba de punta a punta: un cambio de fechas que trae el calendario se
 * aplica solo, sin pasar por Alertas (decisión del dueño, 16/09/2026). Contra
 * la base DEV.
 *
 * No corre una sincronización completa (esa lee y toca los calendarios de
 * verdad): arma el plan con la función pura y aplica con la misma función que
 * usa la sincronización. Trabaja con UNA reserva inventada de 2030 y borra
 * SOLO lo que creó.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { generarLimpiezas } from "../lib/limpiezas/generar";
import { planificarCambios } from "../lib/ical/cambios";
import { aplicarFechas, type ResumenSync } from "../lib/ical/sincronizar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CODIGO = "HMPRUEBAFEC";
const HOY = "2030-01-01";

describe.skipIf(!url || !clave)("cambio de fechas del calendario (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  let reservaId: string | null = null;

  afterAll(async () => {
    if (!reservaId) return;
    for (const tabla of ["cambios_calendario", "limpiezas", "eventos_estadia", "equipamiento_bebe"] as const) {
      const { error } = await s.from(tabla).delete().eq("reserva_id", reservaId);
      expect(error, `no se pudieron borrar ${tabla} de la prueba`).toBeNull();
    }
    const { error } = await s.from("reservas").delete().eq("id", reservaId);
    expect(error, "no se pudo borrar la reserva de la prueba").toBeNull();
  });

  it("la reserva toma las fechas del calendario, con su limpieza y su cuna, y queda registrado", async () => {
    const { data: previa } = await s.from("reservas").select("id").eq("codigo_reserva", CODIGO).maybeSingle();
    expect(previa, `ya existe ${CODIGO}: quedó sucia una corrida anterior`).toBeNull();

    const { data: depto } = await s.from("departamentos").select("id").eq("activo", true).limit(1).single();
    const { data: creada, error } = await s
      .from("reservas")
      .insert({
        codigo_reserva: CODIGO,
        canal: "airbnb",
        origen: "ical",
        datos_completos: false,
        depto_id: depto!.id,
        fecha_checkin: "2030-07-10",
        fecha_checkout: "2030-07-13",
        noches: 3,
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    reservaId = creada!.id;
    await generarLimpiezas(s, [CODIGO], HOY);

    // Una cuna para toda la estadía y una silla pedida a partir del 12 (a mano).
    const { error: errorEquipo } = await s.from("equipamiento_bebe").insert([
      { tipo: "cuna", reserva_id: reservaId, depto_id: depto!.id, fecha_desde: "2030-07-10", fecha_hasta: "2030-07-13" },
      { tipo: "silla", reserva_id: reservaId, depto_id: depto!.id, fecha_desde: "2030-07-12", fecha_hasta: "2030-07-13" },
    ]);
    expect(errorEquipo).toBeNull();

    // Una marca vieja de "Aplicar fechas nuevas" que nadie tocó: se cierra.
    await s.from("cambios_calendario").insert({
      reserva_id: reservaId,
      tipo: "cambio_fechas",
      firma: "vieja",
      calendario_checkin: "2030-07-10",
      calendario_checkout: "2030-07-14",
    });
    const { data: marcas } = await s
      .from("cambios_calendario")
      .select("id, reserva_id, tipo, estado, firma, activo, origen")
      .eq("reserva_id", reservaId);

    const plan = planificarCambios({
      reservas: [
        { id: reservaId, codigo_reserva: CODIGO, depto_id: depto!.id, fecha_checkin: "2030-07-10", fecha_checkout: "2030-07-13" },
      ],
      vistos: [{ codigo: CODIGO, depto_id: depto!.id, desde: "2030-07-11", hasta: "2030-07-15" }],
      marcas: (marcas ?? []).map((m) => ({ ...m, origen: "calendario" as const })),
    });
    expect(plan.nuevas).toEqual([]);
    expect(plan.fechasAAplicar).toHaveLength(1);

    const resumen = { cambiosFechas: 0, avisos: [] as string[] } as unknown as ResumenSync;
    await aplicarFechas(s, plan.fechasAAplicar, HOY, resumen);
    expect(resumen.cambiosFechas).toBe(1);

    const { data: reserva } = await s
      .from("reservas")
      .select("fecha_checkin, fecha_checkout, noches")
      .eq("id", reservaId)
      .single();
    expect(reserva).toEqual({ fecha_checkin: "2030-07-11", fecha_checkout: "2030-07-15", noches: 4 });

    const { data: salida } = await s
      .from("limpiezas")
      .select("fecha, estado")
      .eq("reserva_id", reservaId)
      .eq("rol_reserva", "salida")
      .single();
    expect(salida).toEqual({ fecha: "2030-07-15", estado: "pendiente" });

    // La cuna se va entera con la reserva; la silla conserva el inicio puesto a
    // mano y mueve el retiro.
    const { data: equipos } = await s
      .from("equipamiento_bebe")
      .select("tipo, fecha_desde, fecha_hasta")
      .eq("reserva_id", reservaId)
      .order("tipo");
    expect(equipos).toEqual([
      { tipo: "cuna", fecha_desde: "2030-07-11", fecha_hasta: "2030-07-15" },
      { tipo: "silla", fecha_desde: "2030-07-12", fecha_hasta: "2030-07-15" },
    ]);

    // Una sola marca, la vieja, ahora confirmada con las fechas aplicadas.
    const { data: registro } = await s
      .from("cambios_calendario")
      .select("estado, calendario_checkin, calendario_checkout, reserva_checkout, resuelto_at")
      .eq("reserva_id", reservaId);
    expect(registro).toHaveLength(1);
    expect(registro![0]).toMatchObject({
      estado: "confirmado",
      calendario_checkin: "2030-07-11",
      calendario_checkout: "2030-07-15",
      reserva_checkout: "2030-07-13",
    });
    expect(registro![0].resuelto_at).not.toBeNull();
  });
});
