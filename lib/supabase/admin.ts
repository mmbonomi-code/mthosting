import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Cliente con permisos de administración, para crear usuarios.
 *
 * Usa la clave `service_role`, que saltea todos los permisos: vive SOLO en
 * el servidor y jamás se expone al navegador (por eso no lleva el prefijo
 * NEXT_PUBLIC_). Si la variable no está configurada devuelve null y la
 * pantalla lo explica en vez de romperse.
 */
export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !clave) return null;

  return createClient<Database>(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
