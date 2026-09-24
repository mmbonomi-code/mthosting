/**
 * Quién ve la caja: manager y administración, y nadie más (decisión del
 * dueño, 11/08/2026).
 *
 * Es la primera pantalla del sistema con la plata de la operación adentro,
 * así que la regla está en la base (`puede_ver_caja()`). Esto es la misma
 * condición del lado del servidor, para decir "no tenés acceso" en vez de
 * mostrar una pantalla vacía.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { personaActual } from "@/lib/permisos";

export async function puedeVerCaja(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  // Una persona desactivada no tiene rol, aunque lo tenga escrito en su ficha.
  const persona = await personaActual(supabase);
  if (!persona) return false;
  return persona.rol === "admin" || persona.rol === "manager";
}
