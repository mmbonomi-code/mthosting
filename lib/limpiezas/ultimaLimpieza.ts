/**
 * La última limpieza `hecha` o `verificada` de un departamento, antes de una
 * fecha. La usan tanto "días sin limpiarse" (solo la fecha) como "de la
 * limpieza anterior" en la vista de limpiadora (fecha + quién + lo que dejó
 * anotado): es la misma consulta, no hace falta repetirla.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type UltimaLimpieza = {
  fecha: string;
  asignado_a: string | null;
  observacion_proxima: string | null;
};

export async function ultimaLimpiezaDelDepto(
  supabase: SupabaseClient<Database>,
  deptoId: string,
  antesDe: string,
  excluirId?: string,
): Promise<UltimaLimpieza | null> {
  let query = supabase
    .from("limpiezas")
    .select("fecha, asignado_a, observacion_proxima")
    .eq("depto_id", deptoId)
    .in("estado", ["hecha", "verificada"])
    .lt("fecha", antesDe)
    .order("fecha", { ascending: false })
    .limit(1);
  if (excluirId) query = query.neq("id", excluirId);

  const { data } = await query.maybeSingle();
  return data ?? null;
}
