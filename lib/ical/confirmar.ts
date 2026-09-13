/**
 * Lo que hace una persona con una marca del calendario (lib/ical/cambios.ts).
 *
 *  - Confirmar una posible cancelación: la reserva pasa a `cancelada`, que es
 *    terminal, y se cancelan sus limpiezas y eventos con la excepción de
 *    siempre (una limpieza en curso, hecha o verificada no se toca y aparece
 *    en conflictos).
 *  - Confirmar un cambio de fechas: la reserva toma las fechas del calendario
 *    y su limpieza se mueve con las reglas del importador.
 *  - Un cambio de departamento NO se confirma desde acá: mover una reserva
 *    mueve la limpieza de edificio, y eso se hace a mano desde la ficha.
 *  - Descartar: la situación exacta queda registrada y no vuelve a marcarse.
 *
 * Todo queda en `audit_log`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { generarLimpiezas } from "@/lib/limpiezas/generar";
import { calcularNoches } from "@/lib/reservas/validar";
import { sumarDias } from "@/lib/fechas";
import { firmaCambio } from "./cambios";

type Cliente = SupabaseClient<Database>;

export type ResultadoCambio = { error: string } | { ok: true; anomalias: string[] };

async function leerMarca(supabase: Cliente, id: string) {
  const { data } = await supabase
    .from("cambios_calendario")
    .select(
      "id, tipo, estado, calendario_checkin, calendario_checkout, reserva:reservas(id, codigo_reserva, cancelada, descartada, depto_id, fecha_checkin, fecha_checkout)",
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

function cerrar(personaId: string | null) {
  return { resuelto_por: personaId, resuelto_at: new Date().toISOString() };
}

export async function confirmarCambioEnBase(
  supabase: Cliente,
  id: string,
  personaId: string | null,
  /** Hoy en Buenos Aires (`yyyy-mm-dd`). Nunca `new Date()` pelado. */
  hoy: string,
): Promise<ResultadoCambio> {
  const marca = await leerMarca(supabase, id);
  if (!marca?.reserva) return { error: "No se encontró la marca." };
  if (marca.estado !== "pendiente") return { error: "Esta marca ya estaba resuelta." };
  const reserva = marca.reserva;

  if (marca.tipo === "cambio_depto") {
    return { error: "El cambio de departamento se hace desde la ficha de la reserva." };
  }

  if (marca.tipo === "posible_cancelacion") {
    if (!reserva.cancelada) {
      const { error } = await supabase
        .from("reservas")
        .update({ cancelada: true })
        .eq("id", reserva.id);
      if (error) return { error: `No se pudo cancelar: ${error.message}` };
    }
  } else {
    const checkin = marca.calendario_checkin;
    const checkout = marca.calendario_checkout;
    if (!checkin || !checkout) return { error: "La marca no tiene las fechas nuevas." };
    const { error } = await supabase
      .from("reservas")
      .update({
        fecha_checkin: checkin,
        fecha_checkout: checkout,
        noches: calcularNoches(checkin, checkout),
      })
      .eq("id", reserva.id);
    if (error) return { error: `No se pudieron cambiar las fechas: ${error.message}` };
  }

  const { error: errorMarca } = await supabase
    .from("cambios_calendario")
    .update({ estado: "confirmado", ...cerrar(personaId) })
    .eq("id", id);
  if (errorMarca) return { error: `Se aplicó, pero no se pudo cerrar la marca: ${errorMarca.message}` };

  // Una reserva cancelada no tiene más fechas ni departamento que revisar.
  if (marca.tipo === "posible_cancelacion") {
    await supabase
      .from("cambios_calendario")
      .update({ estado: "resuelto_solo", ...cerrar(personaId) })
      .eq("reserva_id", reserva.id)
      .eq("estado", "pendiente");
  }

  try {
    const vecinas = await reservasVecinas(supabase, reserva, [
      marca.calendario_checkin,
      marca.calendario_checkout,
    ]);
    const resumen = await generarLimpiezas(
      supabase,
      [reserva.codigo_reserva, ...vecinas],
      hoy,
      // Solo las cancelaciones de ahora avisan si la estadía estaba en curso.
      marca.tipo === "posible_cancelacion" ? new Set([reserva.codigo_reserva]) : new Set(),
    );
    return { ok: true, anomalias: resumen.anomalias };
  } catch (e) {
    // La reserva YA quedó cambiada: no se miente diciendo que no pasó nada.
    return {
      error:
        "La reserva quedó actualizada, pero su limpieza y sus eventos no se " +
        `pudieron reacomodar: ${e instanceof Error ? e.message : "error desconocido"}. ` +
        "Revisalos a mano.",
    };
  }
}

/**
 * Las otras reservas vivas del departamento que tocan las fechas en juego.
 *
 * Hacen falta en el recálculo: cuando Airbnb cancela y vuelve a alquilar las
 * mismas fechas, la reserva nueva no tiene limpieza porque el día lo ocupaba
 * la de la cancelada (BORGES 2, 13/09/2026). Si se cancela solo la vieja, el
 * día queda libre pero nadie le crea la limpieza a la nueva.
 */
async function reservasVecinas(
  supabase: Cliente,
  reserva: { id: string; depto_id: string | null; fecha_checkin: string | null; fecha_checkout: string | null },
  otrasFechas: (string | null)[],
): Promise<string[]> {
  const fechas = [reserva.fecha_checkin, reserva.fecha_checkout, ...otrasFechas]
    .filter((f): f is string => f !== null)
    .sort();
  if (!reserva.depto_id || fechas.length === 0) return [];

  const { data } = await supabase
    .from("reservas")
    .select("codigo_reserva")
    .eq("depto_id", reserva.depto_id)
    .eq("cancelada", false)
    .eq("descartada", false)
    .neq("id", reserva.id)
    .gte("fecha_checkout", sumarDias(fechas[0], -1))
    .lte("fecha_checkin", sumarDias(fechas[fechas.length - 1], 1));
  return (data ?? []).map((r) => r.codigo_reserva);
}

export async function descartarCambioEnBase(
  supabase: Cliente,
  id: string,
  personaId: string | null,
): Promise<ResultadoCambio> {
  const { data, error } = await supabase
    .from("cambios_calendario")
    .update({ estado: "descartado", ...cerrar(personaId) })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("id");
  if (error) return { error: `No se pudo descartar: ${error.message}` };
  if (!data || data.length === 0) return { error: "Esta marca ya estaba resuelta." };
  return { ok: true, anomalias: [] };
}

/**
 * "Marcarlas igual": las posibles cancelaciones que el freno de desaparición
 * masiva retuvo pasan a ser marcas pendientes normales, para confirmar una
 * por una. Se vuelve a mirar cada reserva: la que ya se canceló, se descartó
 * o ya tiene marca, se saltea.
 */
export async function marcarRetenidasEnBase(
  supabase: Cliente,
  reservaIds: string[],
): Promise<{ error: string } | { ok: true; marcadas: number }> {
  if (reservaIds.length === 0) return { ok: true, marcadas: 0 };

  const [{ data: reservas, error }, { data: pendientes }] = await Promise.all([
    supabase
      .from("reservas")
      .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout, cancelada, descartada")
      .in("id", reservaIds),
    supabase
      .from("cambios_calendario")
      .select("reserva_id")
      .in("reserva_id", reservaIds)
      .eq("tipo", "posible_cancelacion")
      .eq("estado", "pendiente"),
  ]);
  if (error) return { error: `No se pudieron leer las reservas: ${error.message}` };

  const yaMarcadas = new Set((pendientes ?? []).map((p) => p.reserva_id));
  const nuevas = (reservas ?? [])
    .filter(
      (r) =>
        !r.cancelada &&
        !r.descartada &&
        !yaMarcadas.has(r.id) &&
        r.depto_id &&
        r.fecha_checkin &&
        r.fecha_checkout,
    )
    .map((r) => {
      const comparable = {
        id: r.id,
        codigo_reserva: r.codigo_reserva,
        depto_id: r.depto_id!,
        fecha_checkin: r.fecha_checkin!,
        fecha_checkout: r.fecha_checkout!,
      };
      return {
        reserva_id: r.id,
        tipo: "posible_cancelacion" as const,
        firma: firmaCambio("posible_cancelacion", comparable, undefined),
        reserva_checkin: comparable.fecha_checkin,
        reserva_checkout: comparable.fecha_checkout,
        reserva_depto_id: comparable.depto_id,
      };
    });

  if (nuevas.length > 0) {
    const { error: errorInsert } = await supabase.from("cambios_calendario").insert(nuevas);
    if (errorInsert) return { error: `No se pudieron marcar: ${errorInsert.message}` };
  }
  return { ok: true, marcadas: nuevas.length };
}
