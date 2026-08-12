/**
 * Cuántas cosas del reporte hay que mirar hoy: pendientes vencidos o que
 * vencen hoy, más cunas o sillas que tenían que estar entregadas y no lo
 * están.
 *
 * Es el número que muestra el menú.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { hoyAR } from "@/lib/fechas";

export async function contarPendientesUrgentes(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const hoy = hoyAR();

  // Un pendiente urgente es uno con fecha de hoy o anterior que sigue
  // abierto: la cuenta se puede hacer en la base, sin traer las filas.
  const [{ count: vencidos }, { count: sinEntregar }] = await Promise.all([
    supabase
      .from("notas_reporte")
      .select("id", { count: "exact", head: true })
      .eq("activo", true)
      .eq("seccion", "pendiente")
      .eq("estado", "pendiente")
      .not("fecha", "is", null)
      .lte("fecha", hoy),
    supabase
      .from("equipamiento_bebe")
      .select("id", { count: "exact", head: true })
      .eq("activo", true)
      .eq("estado", "pedido")
      .lte("fecha_desde", hoy),
  ]);

  return (vencidos ?? 0) + (sinEntregar ?? 0);
}
