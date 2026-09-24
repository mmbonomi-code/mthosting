/**
 * Quién ve el panel de alertas (spec §3.8, fila "Panel de alertas").
 *
 * Admin, manager y coordinador. Gobernanta, limpieza y propietario quedan
 * afuera: es información de coordinación operativa, no de reparto de
 * limpieza ni de la vista del propietario.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { personaActual, type Rol } from "@/lib/permisos";

const ROLES: readonly Rol[] = ["admin", "manager", "coordinador"];

/** La regla, separada de la sesión para poder probarla. */
export function rolPuedeVerAlertas(rol: Rol | null): boolean {
  return rol !== null && ROLES.includes(rol);
}

export async function puedeVerAlertas(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  // Una persona desactivada no tiene rol, aunque lo tenga escrito en su ficha.
  const persona = await personaActual(supabase);
  if (!persona) return false;
  return rolPuedeVerAlertas(persona.rol);
}
