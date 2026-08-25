/**
 * Quién ve "Mis limpiezas" (spec §3.8, fila "Vista de limpiadora (sus
 * propias limpiezas)"): admin, manager, gobernanta y limpieza. El
 * coordinador no tiene esta pantalla propia — su capacidad de ver y cargar
 * fotos de cualquier limpieza (spec Fase 2 §3) es otra cosa, resuelta desde
 * la ficha de administración de la limpieza, no acá.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Rol } from "@/lib/permisos";

const ROLES: readonly Rol[] = ["admin", "manager", "gobernanta", "limpieza"];

export function rolPuedeVerMisLimpiezas(rol: Rol | null): boolean {
  return rol !== null && ROLES.includes(rol);
}

export async function puedeVerMisLimpiezas(
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
  return rolPuedeVerMisLimpiezas(persona.rol);
}

/** El id de `personas` de quien está en sesión, para filtrar `asignado_a`. */
export async function miPersonaId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: persona } = await supabase
    .from("personas")
    .select("id, activo")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!persona?.activo) return null;
  return persona.id;
}
