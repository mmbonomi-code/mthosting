/**
 * Quién puede cargar reservas a mano y editar las que ya están (§2.10.bis).
 *
 * Manager, administración y **coordinación** (decisión del dueño, 14/08/2026).
 * Antes el coordinador quedaba afuera por miedo a que una fecha mal escrita
 * moviera limpiezas; en la práctica es quien más habla con el huésped y quien
 * primero se entera de un cambio, así que dejarlo pedirle el cambio a otro
 * hacía que la reserva quedara desactualizada más tiempo.
 *
 * El riesgo de fondo sigue existiendo y se mitiga en otro lado: la importación
 * de Airbnb pisa lo editado a mano, y la pantalla de edición lo avisa antes de
 * guardar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import type { Rol } from "@/lib/permisos";

const ROLES: readonly Rol[] = ["admin", "manager", "coordinador"];

/**
 * La regla, separada de la sesión para poder probarla. Sin rol no se puede:
 * acá no vale la excepción del primer uso, porque para cargar una reserva ya
 * tiene que existir la ficha de quien la carga.
 */
export function rolPuedeEditarReservas(rol: Rol | null): boolean {
  return rol !== null && ROLES.includes(rol);
}

export async function puedeEditarReservas(
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

  // Una persona desactivada no tiene rol, aunque lo tenga escrito en su ficha.
  if (!persona?.activo) return false;
  return rolPuedeEditarReservas(persona.rol);
}
