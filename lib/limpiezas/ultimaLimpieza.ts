/**
 * La limpieza anterior (hecha o verificada) del mismo departamento, para
 * varias limpiezas a la vez. La usan tanto "días sin limpiarse" (solo la
 * fecha) como "de la limpieza anterior" en la vista de limpiadora (fecha y lo
 * que dejó anotado para la próxima).
 *
 * Va por la función `limpiezas_anteriores()` y no por la tabla: RLS le deja
 * ver a la limpiadora solo sus limpiezas, y si la anterior la hizo otra
 * persona, se quedaba sin la fecha y sin la nota que le dejaron a ella
 * (decisión del dueño, 24/09/2026). La función devuelve solo eso, y solo para
 * limpiezas que quien pregunta puede ver.
 *
 * Una sola consulta para toda la lista, no una por limpieza.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type UltimaLimpieza = {
  fecha: string;
  observacion_proxima: string | null;
};

export async function limpiezasAnteriores(
  supabase: SupabaseClient<Database>,
  limpiezaIds: string[],
): Promise<Map<string, UltimaLimpieza>> {
  const porLimpieza = new Map<string, UltimaLimpieza>();
  if (limpiezaIds.length === 0) return porLimpieza;

  const { data, error } = await supabase.rpc("limpiezas_anteriores", { p_ids: limpiezaIds });
  if (error) throw new Error(`No se pudo leer la limpieza anterior: ${error.message}`);

  for (const fila of data ?? []) {
    porLimpieza.set(fila.limpieza_id, {
      fecha: fila.fecha,
      observacion_proxima: fila.observacion_proxima,
    });
  }
  return porLimpieza;
}
