/**
 * Aplica contra la base el plan de limpiezas y eventos (spec §2.8).
 *
 * Lee todo lo que necesita en unas pocas consultas, decide con
 * `planificarLimpiezas` (que es pura y tiene tests) y escribe en lote.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import {
  planificarLimpiezas,
  type Bloqueo,
  type EventoExistente,
  type LimpiezaExistente,
  type ReservaPlan,
} from "./planificar";

type Cliente = SupabaseClient<Database>;

export type ResumenLimpiezas = {
  generadas: number;
  movidas: number;
  canceladas: number;
  anomalias: string[];
};

/** Días de historia que se miran alrededor del lote para ubicar cada reserva. */
const VENTANA_DIAS = 365;

function correrDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

export async function generarLimpiezas(
  supabase: Cliente,
  codigosReserva: string[],
  hoy: string,
  cancelacionesNuevas: ReadonlySet<string> = new Set(),
): Promise<ResumenLimpiezas> {
  if (codigosReserva.length === 0) {
    return { generadas: 0, movidas: 0, canceladas: 0, anomalias: [] };
  }

  // 1. Las reservas del lote.
  const reservas: ReservaPlan[] = [];
  for (let i = 0; i < codigosReserva.length; i += 200) {
    const { data, error } = await supabase
      .from("reservas")
      .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout, cancelada, descartada")
      .in("codigo_reserva", codigosReserva.slice(i, i + 200));
    if (error) throw new Error(`No se pudieron leer las reservas del lote: ${error.message}`);
    reservas.push(...(data ?? []));
  }

  const deptos = [...new Set(reservas.map((r) => r.depto_id).filter((d): d is string => !!d))];
  if (deptos.length === 0) {
    return { generadas: 0, movidas: 0, canceladas: 0, anomalias: [] };
  }

  // 2. Contexto: el resto de las reservas vigentes de esos departamentos,
  //    en una ventana amplia alrededor de las fechas del lote.
  const fechas = reservas.flatMap((r) => [r.fecha_checkin, r.fecha_checkout]).filter(Boolean) as string[];
  const desde = correrDias(fechas.sort()[0] ?? hoy, -VENTANA_DIAS);
  const hasta = correrDias(fechas[fechas.length - 1] ?? hoy, VENTANA_DIAS);

  const { data: contexto, error: errorContexto } = await supabase
    .from("reservas")
    .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout, cancelada, descartada")
    .in("depto_id", deptos)
    .eq("cancelada", false)
    .eq("descartada", false)
    .gte("fecha_checkout", desde)
    .lte("fecha_checkin", hasta);
  if (errorContexto) {
    throw new Error(`No se pudo leer el contexto de reservas: ${errorContexto.message}`);
  }

  // 3. Bloqueos, eventos y limpiezas que ya existen.
  const idsReservas = reservas.map((r) => r.id);

  const { data: bloqueos } = await supabase
    .from("bloqueos")
    .select("depto_id, fecha_desde, fecha_hasta")
    .in("depto_id", deptos)
    .eq("activo", true);

  const eventos: EventoExistente[] = [];
  const limpiezas: LimpiezaExistente[] = [];
  for (let i = 0; i < idsReservas.length; i += 200) {
    const tanda = idsReservas.slice(i, i + 200);
    const [{ data: ev }, { data: li }] = await Promise.all([
      supabase.from("eventos_estadia").select("id, reserva_id, tipo, estado").in("reserva_id", tanda),
      supabase
        .from("limpiezas")
        .select("id, reserva_id, rol_reserva, fecha, estado, urgente, prox_checkin")
        .in("reserva_id", tanda),
    ]);
    eventos.push(...((ev ?? []) as EventoExistente[]));
    limpiezas.push(...((li ?? []) as LimpiezaExistente[]));
  }

  // 4. Decidir.
  const plan = planificarLimpiezas({
    reservas,
    contexto: (contexto ?? []) as ReservaPlan[],
    bloqueos: (bloqueos ?? []) as Bloqueo[],
    eventos,
    limpiezas,
    hoy,
    cancelacionesNuevas,
  });

  // 5. Escribir, siempre en lote.
  for (let i = 0; i < plan.eventosNuevos.length; i += 500) {
    const { error } = await supabase
      .from("eventos_estadia")
      .upsert(plan.eventosNuevos.slice(i, i + 500), {
        onConflict: "reserva_id,tipo",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`No se pudieron crear los eventos: ${error.message}`);
  }

  for (let i = 0; i < plan.eventosACancelar.length; i += 500) {
    const { error } = await supabase
      .from("eventos_estadia")
      .update({ estado: "cancelado" })
      .in("id", plan.eventosACancelar.slice(i, i + 500));
    if (error) throw new Error(`No se pudieron cancelar los eventos: ${error.message}`);
  }

  for (let i = 0; i < plan.limpiezasNuevas.length; i += 500) {
    const { error } = await supabase
      .from("limpiezas")
      .insert(plan.limpiezasNuevas.slice(i, i + 500));
    if (error) throw new Error(`No se pudieron crear las limpiezas: ${error.message}`);
  }

  // Las actualizaciones se agrupan por cambio idéntico: la mayoría comparte
  // el mismo (por ejemplo, "cancelada"), así que salen en pocas consultas.
  const porCambio = new Map<string, string[]>();
  for (const { id, ...cambios } of plan.limpiezasAActualizar) {
    const clave = JSON.stringify(cambios);
    if (!porCambio.has(clave)) porCambio.set(clave, []);
    porCambio.get(clave)!.push(id);
  }
  for (const [clave, ids] of porCambio) {
    const { error } = await supabase.from("limpiezas").update(JSON.parse(clave)).in("id", ids);
    if (error) throw new Error(`No se pudieron actualizar las limpiezas: ${error.message}`);
  }

  return {
    generadas: plan.generadas,
    movidas: plan.movidas,
    canceladas: plan.canceladas,
    anomalias: plan.anomalias,
  };
}
