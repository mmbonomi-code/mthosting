/**
 * Quién escribe en el Reporte: coordinador, manager y administración
 * (decisión del dueño, 11/08/2026 — "back office" y "coordinador" son el
 * mismo rol).
 *
 * Leerlo lo puede cualquiera que use el sistema: un aviso como "Arenales 5:
 * pintan el 28 y 29" o una cuna pedida para el jueves le sirve a quien
 * coordina ese día, no solo a quien lo escribió. Acá no hay montos.
 *
 * La regla de verdad está en la política RLS `puede_escribir_reporte()`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { personaActual } from "@/lib/permisos";

export async function puedeEscribirReporte(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  // Una persona desactivada no tiene rol, aunque lo tenga escrito en su ficha.
  const persona = await personaActual(supabase);
  if (!persona) return false;
  return (
    persona.rol === "admin" ||
    persona.rol === "manager" ||
    persona.rol === "coordinador"
  );
}
