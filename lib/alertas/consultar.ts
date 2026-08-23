/**
 * Trae los datos de las 7 listas del panel de alertas (spec §3.6) y les
 * aplica la detección pura.
 *
 * Un solo lugar para las queries: lo usan tanto la pantalla `/alertas` (que
 * necesita el detalle) como el contador del menú (que solo necesita cuántas
 * hay). Ninguno de los dos reimplementa el cálculo — los dos llaman acá.
 *
 * Todo se recalcula en cada visita, nada queda guardado (mismo criterio que
 * económico: un total guardado puede quedar viejo, uno recalculado no).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { hoyAR, sumarDias } from "@/lib/fechas";
import { limpiezasEnMedioDeEstadia, type Alerta } from "@/lib/limpiezas/alertas";
import { semaforoDeLimpieza, type Semaforo } from "@/lib/limpiezas/semaforo";
import {
  conflictosCancelacionOFecha,
  conflictosLateCheckout,
  detectarFaltaLimpieza,
  ventanasInsuficientesGlobal,
  type AlertaVentana,
  type ConflictoLate,
  type ConflictoReserva,
  type FaltaLimpieza,
  type MovimientoVentana,
  type ReservaCobertura,
  type ReservaLate,
} from "@/lib/alertas/detectar";

export type FilaSinResponsable = {
  id: string;
  depto_id: string;
  fecha: string;
  tipo: string;
  semaforo: Semaforo;
};

export type PanelAlertas = {
  desde: string;
  hasta: string;
  estadiaOcupada: Alerta[];
  ventanaInsuficiente: AlertaVentana[];
  faltaLimpieza: FaltaLimpieza[];
  sinResponsable: FilaSinResponsable[];
  sinDepto: number;
  conflictos: ConflictoReserva[];
  lateCheckout: ConflictoLate[];
};

export async function calcularPanelAlertas(
  supabase: SupabaseClient<Database>,
): Promise<PanelAlertas> {
  const hoy = hoyAR();
  const desde = sumarDias(hoy, -3);
  const hasta = sumarDias(hoy, 21);

  const [
    { data: parametros },
    { data: reservasVentana },
    { data: limpiezasIntocables },
    { data: limpiezasRango },
    { data: reservasRango },
    { data: sinResponsableCruda },
    { count: sinDepto },
  ] = await Promise.all([
    supabase.from("parametros_operativos").select("clave, valor"),
    supabase
      .from("reservas")
      .select(
        `id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout,
         eventos:eventos_estadia(id, tipo, fecha_coordinada, hora_coordinada, late_checkout)`,
      )
      .not("depto_id", "is", null)
      .eq("cancelada", false)
      .eq("descartada", false)
      .or(
        `and(fecha_checkin.gte.${desde},fecha_checkin.lte.${hasta}),and(fecha_checkout.gte.${desde},fecha_checkout.lte.${hasta})`,
      ),
    supabase
      .from("limpiezas")
      .select(
        `id, depto_id, fecha, estado, rol_reserva, reserva_id,
         reserva:reservas(id, codigo_reserva, cancelada, descartada, fecha_checkin, fecha_checkout)`,
      )
      .in("estado", ["en_curso", "hecha", "verificada"])
      .gte("fecha", desde),
    supabase
      .from("limpiezas")
      .select("id, depto_id, fecha, tipo, estado")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .neq("estado", "cancelada"),
    supabase
      .from("reservas")
      .select("depto_id, codigo_reserva, fecha_checkin, fecha_checkout, cancelada, descartada")
      .eq("cancelada", false)
      .eq("descartada", false)
      .lte("fecha_checkin", hasta)
      .gte("fecha_checkout", desde),
    supabase
      .from("limpiezas")
      .select("id, depto_id, fecha, tipo, estado, asignado_a")
      .is("asignado_a", null)
      .neq("estado", "cancelada")
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .is("depto_id", null)
      .eq("descartada", false),
  ]);

  const config = Object.fromEntries((parametros ?? []).map((p) => [p.clave, p.valor]));
  const umbrales = {
    horaLimiteCheckout: config.hora_limite_checkout ?? "11:00",
    horaMinimaCheckin: config.hora_minima_checkin ?? "12:00",
  };

  // --- 0.b y 1 y 5: se derivan todas de la misma query de reservas en ventana ---
  const movimientos: MovimientoVentana[] = [];
  const cobertura: ReservaCobertura[] = [];
  const late: ReservaLate[] = [];
  const idsReservaVentana: string[] = [];

  for (const r of reservasVentana ?? []) {
    if (!r.depto_id || !r.fecha_checkin || !r.fecha_checkout) continue;
    idsReservaVentana.push(r.id);

    const eventoCheckout = r.eventos?.find((e) => e.tipo === "checkout");
    const eventoCheckin = r.eventos?.find((e) => e.tipo === "checkin");

    movimientos.push({
      reserva_id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      tipo: "checkout",
      fecha: eventoCheckout?.fecha_coordinada ?? r.fecha_checkout,
      hora: eventoCheckout?.hora_coordinada ?? null,
    });
    movimientos.push({
      reserva_id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      tipo: "checkin",
      fecha: eventoCheckin?.fecha_coordinada ?? r.fecha_checkin,
      hora: eventoCheckin?.hora_coordinada ?? null,
    });

    cobertura.push({
      id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
    });

    late.push({
      id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
      lateCheckout: eventoCheckout?.late_checkout ?? false,
    });
  }

  const ventanaInsuficiente = ventanasInsuficientesGlobal(movimientos, umbrales);

  const deptosEnVentana = [...new Set(cobertura.map((r) => r.depto_id))];

  const [{ data: limpiezasCobertura }, { data: contextoDepto }] = await Promise.all([
    idsReservaVentana.length > 0
      ? supabase
          .from("limpiezas")
          .select("reserva_id, rol_reserva, estado")
          .in("reserva_id", idsReservaVentana)
      : Promise.resolve({
          data: [] as { reserva_id: string | null; rol_reserva: string | null; estado: string }[],
        }),
    // Sin cota de fecha hacia atrás a propósito: para saber si una reserva es
    // "la primera del depto" hace falta el check-out anterior, sea de cuando
    // sea, no solo el que cae dentro de la ventana de 24 días.
    deptosEnVentana.length > 0
      ? supabase
          .from("reservas")
          .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout")
          .in("depto_id", deptosEnVentana)
          .eq("cancelada", false)
          .eq("descartada", false)
          .lte("fecha_checkout", hasta)
      : Promise.resolve({ data: [] as ReservaCobertura[] }),
  ]);

  const contexto: ReservaCobertura[] = (contextoDepto ?? [])
    .filter(
      (r): r is typeof r & { depto_id: string; fecha_checkin: string; fecha_checkout: string } =>
        r.depto_id !== null && r.fecha_checkin !== null && r.fecha_checkout !== null,
    )
    .map((r) => ({
      id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
    }));

  const faltaLimpieza = detectarFaltaLimpieza(
    cobertura,
    contexto,
    (limpiezasCobertura ?? []) as {
      reserva_id: string | null;
      rol_reserva: "salida" | "entrada" | "durante" | null;
      estado: string;
    }[],
  );

  const lateCheckout = conflictosLateCheckout(late);

  // --- 4: limpiezas intocables cuya reserva se movió por debajo ---
  const reservasDeIntocables = new Map<
    string,
    {
      id: string;
      codigo_reserva: string;
      cancelada: boolean;
      descartada: boolean;
      fecha_checkin: string | null;
      fecha_checkout: string | null;
    }
  >();
  for (const l of limpiezasIntocables ?? []) {
    if (l.reserva && !reservasDeIntocables.has(l.reserva.id)) {
      reservasDeIntocables.set(l.reserva.id, l.reserva);
    }
  }
  const conflictos = conflictosCancelacionOFecha(
    (limpiezasIntocables ?? []).map((l) => ({
      id: l.id,
      depto_id: l.depto_id,
      fecha: l.fecha,
      estado: l.estado,
      rol_reserva: l.rol_reserva,
      reserva_id: l.reserva_id,
    })),
    [...reservasDeIntocables.values()],
  );

  // --- 0: limpieza sobre estadía ocupada (reutiliza lib/limpiezas/alertas.ts) ---
  const estadiaOcupada = limpiezasEnMedioDeEstadia(
    (limpiezasRango ?? []).map((l) => ({
      id: l.id,
      depto_id: l.depto_id,
      fecha: l.fecha,
      tipo: l.tipo,
      estado: l.estado,
    })),
    (reservasRango ?? []).map((r) => ({
      depto_id: r.depto_id,
      codigo_reserva: r.codigo_reserva,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
      cancelada: r.cancelada,
      descartada: r.descartada,
    })),
  ).filter((a) => a.motivo === "en_medio_de_estadia");

  // --- 2: sin responsable, solo semáforo rojo o ámbar ---
  const sinResponsable: FilaSinResponsable[] = (sinResponsableCruda ?? [])
    .map((l) => ({
      id: l.id,
      depto_id: l.depto_id,
      fecha: l.fecha,
      tipo: l.tipo,
      semaforo: semaforoDeLimpieza({ fecha: l.fecha, hoy, tieneResponsable: false }),
    }))
    .filter((f) => f.semaforo === "rojo" || f.semaforo === "ambar");

  return {
    desde,
    hasta,
    estadiaOcupada,
    ventanaInsuficiente,
    faltaLimpieza,
    sinResponsable,
    sinDepto: sinDepto ?? 0,
    conflictos,
    lateCheckout,
  };
}

export function contarCriticas(panel: PanelAlertas): number {
  return panel.estadiaOcupada.length + panel.ventanaInsuficiente.length;
}

export function contarResto(panel: PanelAlertas): number {
  return (
    panel.faltaLimpieza.length +
    panel.sinResponsable.length +
    panel.sinDepto +
    panel.conflictos.length +
    panel.lateCheckout.length
  );
}
