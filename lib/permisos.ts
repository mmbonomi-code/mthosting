/**
 * El rol de quien está usando el sistema, en un solo lugar.
 *
 * Cada módulo con permisos propios (caja, reclamos, reporte, reservas) tiene
 * su función con nombre propio, porque su regla puede cambiar sola. Esto es
 * la base que todas comparten y lo que usan las pantallas de configuración,
 * donde la regla es siempre la misma: manager y administración.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Rol = Database["public"]["Enums"]["rol_usuario"];

export async function rolDelUsuario(
  supabase: SupabaseClient<Database>,
): Promise<Rol | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: persona } = await supabase
    .from("personas")
    .select("rol, activo")
    .eq("profile_id", user.id)
    .maybeSingle();

  // Una persona desactivada no tiene rol para el sistema, aunque lo tenga
  // escrito en su ficha.
  if (!persona?.activo) return null;
  return persona.rol;
}

/**
 * Manager y administración. Es la regla de la configuración del sistema:
 * valores de limpieza, personas, accesos, feriados y parámetros
 * (spec §3.8).
 */
export async function esManagerOAdmin(
  supabase: SupabaseClient<Database>,
): Promise<boolean> {
  const rol = await rolDelUsuario(supabase);
  return rol === "admin" || rol === "manager";
}
