/**
 * Las fotos que la limpieza cargó en el check-out de una reserva
 * (docs/FASE-1-RECLAMOS-ESPECIFICACION.md §6).
 *
 * Al crear un reclamo se adjuntan solas, marcadas con origen "limpieza".
 * Maguie puede sacar las que no sirvan y agregar otras.
 *
 * Toda la conexión entre el módulo de limpieza (Fase 2) y el de reclamos
 * pasa por acá, como pide la spec: "no dispersar la lógica por los
 * componentes".
 *
 * DOS DECISIONES QUE VALE LA PENA DEJAR ESCRITAS:
 *
 * 1. Se copia el archivo al bucket de reclamos, no se referencia el de
 *    limpiezas. Son buckets distintos y el reclamo firma sus URLs contra el
 *    suyo, así que una referencia cruzada directamente no abriría. Además la
 *    evidencia de un reclamo de plata no debería depender de que nadie toque
 *    la foto de la limpieza: el reclamo se queda con su propia copia.
 *
 * 2. Solo van las fotos de DAÑO: "lo que dejó el huésped" y "algo para
 *    arreglar". Las del departamento terminado quedan afuera a propósito —
 *    son el depto ya limpio, no prueban ningún daño, y adjuntar tres fotos
 *    de un depto impecable a un reclamo solo agrega ruido.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  limpiezasDeLaReserva,
  type LimpiezaDeFoto,
  type ReservaDelDepto,
} from "@/lib/alertas/fotos";
import { BUCKET_LIMPIEZAS } from "@/lib/limpiezas/storage";
import { BUCKET } from "./storage";

export type FotoLimpieza = {
  storage_path: string;
  tomada_at: string | null;
};

/** Las de daño, en orden de utilidad para el reclamo. */
const TIPOS_DE_DANIO = ["huesped", "arreglar"] as const;

const CAMPOS_LIMPIEZA = "id, depto_id, fecha, tipo, rol_reserva, reserva_id, danio_huesped";

/**
 * Las limpiezas cuyo daño se le reclama a esta reserva, con la MISMA regla
 * que usa Alertas (`reservaAReclamar`). Antes se tomaban las atadas por
 * `reserva_id`, y la limpieza de un recambio está atada a la reserva que
 * llega: el reclamo al que se fue salía sin texto ni fotos, y uno al que
 * llegó se llevaba el daño ajeno.
 *
 * Adjuntar evidencia es un extra: si algo falla, devuelve lo que pudo (o
 * nada) y el reclamo se crea igual. Nunca al revés.
 */
export async function limpiezasDelReclamo(
  supabase: SupabaseClient<Database>,
  reservaId: string,
): Promise<LimpiezaDeFoto[]> {
  const { data: reserva } = await supabase
    .from("reservas")
    .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout")
    .eq("id", reservaId)
    .maybeSingle();
  if (!reserva?.depto_id || !reserva.fecha_checkin || !reserva.fecha_checkout) return [];
  const objetivo: ReservaDelDepto = {
    id: reserva.id,
    codigo_reserva: reserva.codigo_reserva,
    depto_id: reserva.depto_id,
    fecha_checkin: reserva.fecha_checkin,
    fecha_checkout: reserva.fecha_checkout,
  };

  // Candidatas: las atadas a la reserva, más las del depto durante la estadía
  // (el respaldo por fecha de `reservaAReclamar` nunca mira fuera de ella).
  // Y las reservas vecinas, para que la regla pueda decidir entre ellas.
  const [{ data: limpiezas, error }, { data: vecinas }] = await Promise.all([
    supabase
      .from("limpiezas")
      .select(CAMPOS_LIMPIEZA)
      .eq("depto_id", objetivo.depto_id)
      .or(
        `reserva_id.eq.${objetivo.id},and(fecha.gte.${objetivo.fecha_checkin},fecha.lte.${objetivo.fecha_checkout})`,
      )
      .order("fecha"),
    supabase
      .from("reservas")
      .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout")
      .eq("depto_id", objetivo.depto_id)
      .eq("cancelada", false)
      .eq("descartada", false)
      .gte("fecha_checkout", objetivo.fecha_checkin)
      .lte("fecha_checkin", objetivo.fecha_checkout),
  ]);
  if (error || !limpiezas) return [];

  const reservas: ReservaDelDepto[] = [
    objetivo,
    ...(vecinas ?? [])
      .filter(
        (r): r is typeof r & { depto_id: string; fecha_checkin: string; fecha_checkout: string } =>
          r.id !== objetivo.id &&
          r.depto_id !== null &&
          r.fecha_checkin !== null &&
          r.fecha_checkout !== null,
      ),
  ];
  return limpiezasDeLaReserva(objetivo.id, limpiezas, reservas);
}

/**
 * Lo que quien limpió escribió sobre el daño, para encabezar el reclamo
 * (pedido del dueño, 23/09/2026). Es un borrador: se edita antes de mandarlo.
 *
 * Si hay varias limpiezas con texto, van todas: el relato completo es más
 * útil que elegir uno por nosotros.
 */
export function motivoDelDanio(limpiezas: LimpiezaDeFoto[]): string | null {
  const textos = limpiezas.map((l) => l.danio_huesped?.trim()).filter(Boolean);
  return textos.length > 0 ? textos.join("\n\n") : null;
}

export async function fotosDeLimpieza(
  supabase: SupabaseClient<Database>,
  limpiezas: LimpiezaDeFoto[],
  reclamoId: string,
): Promise<FotoLimpieza[]> {
  const ids = limpiezas.map((l) => l.id);
  if (ids.length === 0) return [];

  const { data: fotos } = await supabase
    .from("limpieza_fotos")
    .select("storage_path, tipo, created_at")
    .in("limpieza_id", ids)
    .in("tipo", [...TIPOS_DE_DANIO])
    .order("created_at");
  if (!fotos || fotos.length === 0) return [];

  // "lo que dejó el huésped" primero: es la evidencia más directa.
  const ordenadas = [...fotos].sort(
    (a, b) =>
      TIPOS_DE_DANIO.indexOf(a.tipo as (typeof TIPOS_DE_DANIO)[number]) -
      TIPOS_DE_DANIO.indexOf(b.tipo as (typeof TIPOS_DE_DANIO)[number]),
  );

  const copiadas: FotoLimpieza[] = [];
  for (const foto of ordenadas) {
    const extension = foto.storage_path.split(".").pop()?.toLowerCase() ?? "jpg";
    const destino = `${reclamoId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from(BUCKET_LIMPIEZAS)
      .copy(foto.storage_path, destino, { destinationBucket: BUCKET });
    // Una foto que no se pudo copiar no puede tumbar la creación del
    // reclamo: se sigue con las demás y Maguie puede subirla a mano.
    if (error) continue;
    copiadas.push({ storage_path: destino, tomada_at: foto.created_at });
  }

  return copiadas;
}
