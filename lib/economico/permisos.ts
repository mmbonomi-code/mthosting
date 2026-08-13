/**
 * Quién ve la sección económica: manager y administración (decisión del
 * dueño, 13/08/2026).
 *
 * La regla está en la base (`puede_ver_economico()`), porque acá hay plata y
 * nombres y apellidos de huéspedes. Esto es la misma condición del lado del
 * servidor, para poder decir "no tenés acceso" en vez de mostrar una pantalla
 * vacía, que parece un error del sistema.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function puedeVerEconomico(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: persona } = await supabase
    .from("personas")
    .select("rol, activo")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!persona?.activo) return false;
  return persona.rol === "admin" || persona.rol === "manager";
}
