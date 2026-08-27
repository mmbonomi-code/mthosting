/**
 * Descartar una reserva a mano (spec §2.10.ter).
 *
 * Es para la reserva que nunca se concretó: la que el calendario anunció y el
 * archivo de Airbnb no confirma nunca. Se marca `descartada = true`, deja de
 * aparecer en las vistas operativas y sus eventos y limpiezas pasan a
 * cancelados, con la excepción de siempre: una limpieza `en_curso`, `hecha` o
 * `verificada` no se toca, se avisa y decide una persona.
 *
 * NO es lo mismo que `cancelada`. `cancelada` la dice Airbnb y es terminal.
 * `descartada` la decide una persona y NO sobrevive a la importación: si la
 * reserva sigue existiendo y aparece en un archivo posterior, vuelve entera,
 * con su check-in, su check-out y su limpieza. Es a propósito — el sistema es
 * un espejo de Airbnb, y un huésped que llega sin que nadie lo espere es peor
 * problema que una fila de más.
 *
 * Ojo: el que la hace reaparecer es el ARCHIVO. La sincronización del
 * calendario no toca una reserva que ya existe, así que no revive nada.
 *
 * Todo queda en `audit_log`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { generarLimpiezas } from "@/lib/limpiezas/generar";

type Cliente = SupabaseClient<Database>;

export type ResultadoDescarte =
  | { error: string }
  | { ok: true; limpiezasCanceladas: number; anomalias: string[] };

export type ResultadoRecuperacion =
  | { error: string }
  | { ok: true; anomalias: string[] };

/** La reserva sale de la operación. Reversible: la importación la devuelve. */
export async function descartarReservaEnBase(
  supabase: Cliente,
  id: string,
  /** Hoy en Buenos Aires (`yyyy-mm-dd`). Nunca `new Date()` pelado. */
  hoy: string,
): Promise<ResultadoDescarte> {
  const { data: reserva } = await supabase
    .from("reservas")
    .select("id, codigo_reserva, descartada")
    .eq("id", id)
    .maybeSingle();

  if (!reserva) return { error: "No se encontró la reserva." };
  if (reserva.descartada) return { error: "Esta reserva ya estaba descartada." };

  const { error } = await supabase
    .from("reservas")
    .update({ descartada: true })
    .eq("id", id);
  if (error) return { error: `No se pudo descartar: ${error.message}` };

  try {
    const resumen = await generarLimpiezas(supabase, [reserva.codigo_reserva], hoy);
    return {
      ok: true,
      limpiezasCanceladas: resumen.canceladas,
      anomalias: resumen.anomalias,
    };
  } catch (e) {
    // La reserva YA quedó descartada: no se miente diciendo que no pasó nada.
    return {
      error:
        "La reserva quedó descartada, pero su limpieza y sus eventos no se " +
        `pudieron cancelar: ${e instanceof Error ? e.message : "error desconocido"}. ` +
        "Revisalos a mano.",
    };
  }
}

/**
 * Deshacer el descarte. Es el mismo camino que usa la importación cuando la
 * reserva reaparece: vuelven el check-in, el check-out y la limpieza.
 */
export async function recuperarReservaEnBase(
  supabase: Cliente,
  id: string,
  hoy: string,
): Promise<ResultadoRecuperacion> {
  const { data: reserva } = await supabase
    .from("reservas")
    .select("id, codigo_reserva, descartada")
    .eq("id", id)
    .maybeSingle();

  if (!reserva) return { error: "No se encontró la reserva." };
  if (!reserva.descartada) return { error: "Esta reserva no estaba descartada." };

  const { error } = await supabase
    .from("reservas")
    .update({ descartada: false })
    .eq("id", id);
  if (error) return { error: `No se pudo recuperar: ${error.message}` };

  try {
    const resumen = await generarLimpiezas(supabase, [reserva.codigo_reserva], hoy);
    return { ok: true, anomalias: resumen.anomalias };
  } catch (e) {
    return {
      error:
        "La reserva volvió a la operación, pero su limpieza y sus eventos no se " +
        `pudieron rearmar: ${e instanceof Error ? e.message : "error desconocido"}. ` +
        "Revisalos a mano.",
    };
  }
}
