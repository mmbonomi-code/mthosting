/**
 * Quién puede ver y tocar los reclamos: coordinador, manager y
 * administración (decisión del dueño, 11/08/2026 — "back office" y
 * "coordinador" son el mismo rol). La gobernanta y el personal de limpieza
 * no acceden, porque acá hay montos.
 *
 * La regla de verdad está en la base, en la política RLS
 * `puede_gestionar_reclamos()`. Esto es la misma condición del lado del
 * servidor, para poder decir "no tenés acceso" en vez de mostrar una
 * pantalla vacía, y para no ofrecer el menú a quien no corresponde.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { personaActual } from "@/lib/permisos";

export async function puedeGestionarReclamos(
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
