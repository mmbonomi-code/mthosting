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
import { BUCKET_LIMPIEZAS } from "@/lib/limpiezas/storage";
import { BUCKET } from "./storage";

export type FotoLimpieza = {
  storage_path: string;
  tomada_at: string | null;
};

/** Las de daño, en orden de utilidad para el reclamo. */
const TIPOS_DE_DANIO = ["huesped", "arreglar"] as const;

export async function fotosDeLimpieza(
  supabase: SupabaseClient<Database>,
  reservaId: string,
  reclamoId: string,
): Promise<FotoLimpieza[]> {
  const { data: limpiezas, error } = await supabase
    .from("limpiezas")
    .select("id")
    .eq("reserva_id", reservaId);
  // Adjuntar evidencia es un extra: si falla, el reclamo se crea igual y las
  // fotos se suben a mano. Nunca al revés.
  if (error) return [];
  const ids = (limpiezas ?? []).map((l) => l.id);
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
