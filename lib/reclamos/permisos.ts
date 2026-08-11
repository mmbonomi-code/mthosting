/**
 * Quién puede ver y tocar los reclamos: back office, manager y
 * administración (decisión del dueño, 11/08/2026). La gobernanta y el
 * personal de limpieza no acceden, porque acá hay montos.
 *
 * La regla de verdad está en la base, en la política RLS
 * `puede_gestionar_reclamos()`. Esto es la misma condición del lado del
 * servidor, para poder decir "no tenés acceso" en vez de mostrar una
 * pantalla vacía, y para no ofrecer el menú a quien no corresponde.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export async function puedeGestionarReclamos(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: persona } = await supabase
    .from("personas")
    .select("rol, es_backoffice, activo")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!persona?.activo) return false;
  return persona.rol === "admin" || persona.rol === "manager" || persona.es_backoffice;
}
