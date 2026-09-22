/**
 * Las cunas y sillas acompañan a la reserva cuando cambian sus fechas
 * (decisión del dueño, 22/09/2026).
 *
 * Cada pedido guarda sus propias fechas, copiadas de la reserva al cargarlo.
 * Si Airbnb mueve la reserva y la cuna no, el Día avisa que hay que llevarla
 * un día en que no llega nadie.
 *
 * La regla es por punta: si la cuna arrancaba el día del check-in, arranca el
 * del check-in nuevo; si terminaba el del check-out, termina el del nuevo.
 * Una punta que alguien puso a mano (una cuna solo para los últimos días) se
 * respeta. Lo ya retirado es historia y no se toca.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

export type Estadia = { checkin: string | null; checkout: string | null };

/** Las fechas nuevas del pedido, o null si no cambia nada o no se puede. */
export function fechasNuevasDelEquipo(
  equipo: { fecha_desde: string; fecha_hasta: string },
  antes: Estadia,
  despues: Estadia,
): { fecha_desde: string; fecha_hasta: string } | null {
  const desde =
    antes.checkin && despues.checkin && equipo.fecha_desde === antes.checkin
      ? despues.checkin
      : equipo.fecha_desde;
  const hasta =
    antes.checkout && despues.checkout && equipo.fecha_hasta === antes.checkout
      ? despues.checkout
      : equipo.fecha_hasta;

  if (desde === equipo.fecha_desde && hasta === equipo.fecha_hasta) return null;
  // Mover una sola punta puede dejarla al revés (una cuna para los primeros
  // días de una estadía que ahora termina antes). Eso lo decide una persona.
  if (hasta < desde) return null;
  return { fecha_desde: desde, fecha_hasta: hasta };
}

/**
 * Mueve los pedidos vivos de la reserva. Devuelve avisos: lo que no se pudo
 * mover, para que alguien lo mire. Nunca lanza: la reserva ya cambió y eso
 * no se deshace por una cuna.
 */
export async function moverEquipamientoConReserva(
  supabase: SupabaseClient<Database>,
  reserva: { id: string; codigo_reserva: string },
  antes: Estadia,
  despues: Estadia,
): Promise<string[]> {
  if (antes.checkin === despues.checkin && antes.checkout === despues.checkout) return [];

  const { data: equipos, error } = await supabase
    .from("equipamiento_bebe")
    .select("id, tipo, fecha_desde, fecha_hasta")
    .eq("reserva_id", reserva.id)
    .eq("activo", true)
    .neq("estado", "retirado");
  if (error) return [`${reserva.codigo_reserva}: no se pudo revisar su cuna o silla (${error.message}).`];

  const avisos: string[] = [];
  for (const e of equipos ?? []) {
    const nuevas = fechasNuevasDelEquipo(e, antes, despues);
    if (!nuevas) {
      const tocaba = e.fecha_desde === antes.checkin || e.fecha_hasta === antes.checkout;
      if (tocaba) {
        avisos.push(
          `${reserva.codigo_reserva}: la reserva cambió de fechas y su ${e.tipo} (${e.fecha_desde} a ${e.fecha_hasta}) no se pudo mover sola. Corregila en el Reporte.`,
        );
      }
      continue;
    }
    const { error: errorMover } = await supabase
      .from("equipamiento_bebe")
      .update(nuevas)
      .eq("id", e.id);
    if (errorMover) {
      avisos.push(
        `${reserva.codigo_reserva}: la reserva cambió de fechas pero su ${e.tipo} no se pudo mover (${errorMover.message}). Corregila en el Reporte.`,
      );
    }
  }
  return avisos;
}
