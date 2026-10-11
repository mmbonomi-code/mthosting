/**
 * Quién ve Calidad: manager y administración (decisión del dueño, 07/10/2026).
 * Hay comentarios privados de huéspedes y el ranking del personal de limpieza.
 *
 * La puerta de verdad está en la base, en `puede_ver_calidad()`. Esto es la
 * misma condición del lado del servidor, para poder decir "no tenés acceso"
 * en vez de mostrar una pantalla vacía. Si se separan, gana la base.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { esManagerOAdmin } from "@/lib/permisos";

export async function puedeVerCalidad(supabase: SupabaseClient<Database>): Promise<boolean> {
  return esManagerOAdmin(supabase);
}
