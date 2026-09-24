/**
 * El rol de quien está usando el sistema, en un solo lugar.
 *
 * Cada módulo con permisos propios (caja, reclamos, reporte, reservas) tiene
 * su función con nombre propio, porque su regla puede cambiar sola. Esto es
 * la base que todas comparten y lo que usan las pantallas de configuración,
 * donde la regla es siempre la misma: manager y administración.
 */

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Rol = Database["public"]["Enums"]["rol_usuario"];

/** La ficha de quien usa el sistema. Null sin sesión o con la ficha inactiva. */
export type PersonaActual = {
  id: string;
  rol: Rol | null;
  nombre: string;
  email: string | null;
} | null;

/**
 * Quién está usando el sistema: una sola ida a Auth y una sola lectura de
 * `personas` por pedido, la usen cuantos permisos la usen.
 *
 * Antes cada permiso (caja, reclamos, económico, alertas…) preguntaba por su
 * cuenta: el menú solo hacía seis `getUser()` —cada uno una vuelta al
 * servidor de Auth— y seis lecturas de la ficha en cada pantalla.
 *
 * `cache` recuerda el resultado mientras dura el pedido, por cliente; como
 * `crearClienteServidor` también se recuerda, todos comparten el mismo. Fuera
 * de un pedido (scripts, tests) no recuerda nada y consulta cada vez.
 */
export const personaActual = cache(
  async (supabase: SupabaseClient<Database>): Promise<PersonaActual> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: persona } = await supabase
      .from("personas")
      .select("id, rol, activo, nombre")
      .eq("profile_id", user.id)
      .maybeSingle();

    // Una persona desactivada no tiene rol para el sistema, aunque lo tenga
    // escrito en su ficha.
    if (!persona?.activo) return null;
    return { id: persona.id, rol: persona.rol, nombre: persona.nombre, email: user.email ?? null };
  },
);

export async function rolDelUsuario(
  supabase: SupabaseClient<Database>,
): Promise<Rol | null> {
  return (await personaActual(supabase))?.rol ?? null;
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
