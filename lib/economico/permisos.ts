/**
 * Quién ve la sección económica: SOLO administración (decisión del dueño,
 * 16/08/2026; antes era también el manager).
 *
 * La puerta de verdad está en la base, en `puede_ver_economico()`, porque acá
 * hay plata, saldos con propietarios y nombres y apellidos de huéspedes. Esto
 * es la misma condición repetida del lado del servidor, y sirve para una sola
 * cosa: poder decir "no tenés acceso" en vez de mostrar una pantalla vacía,
 * que parece un error del sistema.
 *
 * Si las dos se separan, gana la base: acá se vería el cartel equivocado, pero
 * el dato no se escapa.
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
  return persona.rol === "admin";
}
