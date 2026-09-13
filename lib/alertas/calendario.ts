/**
 * Las alertas que salen del calendario de Airbnb: las marcas pendientes de
 * confirmar (lib/ical/cambios.ts) y los problemas de la última sincronización
 * — lo que se frenó por desaparición masiva, lo que no se pudo leer, y la
 * sincronización automática que dejó de correr.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { sumarDias } from "@/lib/fechas";
import type { MotivoRetencion, Retenida, TipoCambio } from "@/lib/ical/cambios";

export type FilaCambioCalendario = {
  id: string;
  tipo: TipoCambio;
  /** excel: la pidió el Excel de tentativas y el calendario todavía la muestra. */
  origen: "calendario" | "excel";
  reserva_id: string;
  codigo_reserva: string;
  /** Donde está hoy la reserva en el sistema. */
  depto_id: string | null;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  huesped_nombre: string | null;
  /** Lo que muestra el calendario. */
  calendario_depto_id: string | null;
  calendario_checkin: string | null;
  calendario_checkout: string | null;
  /** La limpieza viva de la reserva: a quién hay que avisarle. */
  limpieza: { fecha: string; estado: string; responsable: string | null } | null;
  /** Pasa en los próximos dos días (o ya está pasando). */
  urgente: boolean;
};

export type ProblemaCalendario =
  | {
      tipo: "retenidas";
      depto_id: string;
      motivo: MotivoRetencion;
      reserva_ids: string[];
      codigos: string[];
    }
  | { tipo: "fallido"; depto_id: string; error: string }
  | { tipo: "sin_sincronizar"; ultima: string | null };

/** Pasado esto sin una sincronización completa, algo se rompió. */
const HORAS_SIN_SINCRONIZAR = 36;

export async function alertasDelCalendario(
  supabase: SupabaseClient<Database>,
  hoy: string,
): Promise<{ cambios: FilaCambioCalendario[]; problemas: ProblemaCalendario[] }> {
  const [{ data: marcas }, { data: ultima }] = await Promise.all([
    supabase
      .from("cambios_calendario")
      .select(
        `id, tipo, origen, reserva_id, calendario_depto_id, calendario_checkin, calendario_checkout,
         reserva:reservas(codigo_reserva, depto_id, fecha_checkin, fecha_checkout, huesped_nombre,
           limpiezas(fecha, estado, responsable:personas(nombre)))`,
      )
      .eq("estado", "pendiente"),
    supabase
      .from("sincronizaciones_ical")
      .select("created_at, retenidas, fallidos")
      .eq("completa", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const limite = sumarDias(hoy, 2);

  const cambios: FilaCambioCalendario[] = (marcas ?? [])
    .filter((m) => m.reserva)
    .map((m) => {
      const r = m.reserva!;
      // La próxima, no la primera: una pendiente vieja que nunca se cerró no
      // es a quién hay que avisarle hoy.
      const viva = (r.limpiezas ?? [])
        .filter((l) => l.estado !== "cancelada" && l.fecha >= hoy)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
      // Si la estadía ya empezó, lo que importa es la salida.
      const fechaClave =
        r.fecha_checkin && r.fecha_checkin >= hoy ? r.fecha_checkin : r.fecha_checkout;
      return {
        id: m.id,
        tipo: m.tipo,
        origen: m.origen === "excel" ? ("excel" as const) : ("calendario" as const),
        reserva_id: m.reserva_id,
        codigo_reserva: r.codigo_reserva,
        depto_id: r.depto_id,
        fecha_checkin: r.fecha_checkin,
        fecha_checkout: r.fecha_checkout,
        huesped_nombre: r.huesped_nombre,
        calendario_depto_id: m.calendario_depto_id,
        calendario_checkin: m.calendario_checkin,
        calendario_checkout: m.calendario_checkout,
        limpieza: viva
          ? { fecha: viva.fecha, estado: viva.estado, responsable: viva.responsable?.nombre ?? null }
          : null,
        urgente:
          (fechaClave !== null && fechaClave >= hoy && fechaClave <= limite) ||
          (viva !== undefined && viva.fecha <= limite),
      };
    })
    // Lo más próximo arriba.
    .sort((a, b) => (a.fecha_checkin ?? "").localeCompare(b.fecha_checkin ?? ""));

  const problemas: ProblemaCalendario[] = [];

  const horas = ultima
    ? (Date.now() - new Date(ultima.created_at).getTime()) / 3_600_000
    : Infinity;
  if (horas > HORAS_SIN_SINCRONIZAR) {
    problemas.push({ tipo: "sin_sincronizar", ultima: ultima?.created_at ?? null });
  }

  if (ultima) {
    const retenidas = (ultima.retenidas ?? []) as Retenida[];
    const ids = retenidas.flatMap((r) => r.reserva_ids);
    if (ids.length > 0) {
      // La corrida queda vieja: lo que después se marcó a mano, se canceló o
      // se descartó ya no es un problema.
      const [{ data: reservas }, { data: yaMarcadas }] = await Promise.all([
        supabase
          .from("reservas")
          .select("id, codigo_reserva, cancelada, descartada")
          .in("id", ids),
        supabase
          .from("cambios_calendario")
          .select("reserva_id")
          .in("reserva_id", ids)
          .eq("tipo", "posible_cancelacion")
          .eq("estado", "pendiente"),
      ]);
      const marcadas = new Set((yaMarcadas ?? []).map((m) => m.reserva_id));
      const vigentes = new Map(
        (reservas ?? [])
          .filter((r) => !r.cancelada && !r.descartada && !marcadas.has(r.id))
          .map((r) => [r.id, r.codigo_reserva]),
      );
      for (const r of retenidas) {
        const quedan = r.reserva_ids.filter((id) => vigentes.has(id));
        if (quedan.length === 0) continue;
        problemas.push({
          tipo: "retenidas",
          depto_id: r.depto_id,
          motivo: r.motivo,
          reserva_ids: quedan,
          codigos: quedan.map((id) => vigentes.get(id)!),
        });
      }
    }

    for (const f of (ultima.fallidos ?? []) as { depto_id: string; error: string }[]) {
      problemas.push({ tipo: "fallido", depto_id: f.depto_id, error: f.error });
    }
  }

  return { cambios, problemas };
}
