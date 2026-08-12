/**
 * Quién puede tocar los datos de una reserva (§2.10.bis).
 *
 * Los campos que llegan del CSV de Airbnb —fechas, huésped, contacto,
 * noches, payout— NO los edita el coordinador. Solo manager y admin. El
 * motivo es que una fecha mal escrita mueve limpiezas y deja a alguien
 * esperando en la puerta.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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

  if (!persona?.activo) return false;
  return persona.rol === "admin" || persona.rol === "manager";
}
