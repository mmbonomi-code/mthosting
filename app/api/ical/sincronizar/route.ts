import { createClient } from "@supabase/supabase-js";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { sincronizarICal } from "@/lib/ical/sincronizar";
import type { Database } from "@/lib/database.types";

export const maxDuration = 60;

/**
 * Sincronización automática de los calendarios (spec §2.12).
 *
 * La llama Vercel según la programación de `vercel.json`, con el secreto de
 * cron. También se puede llamar a mano estando logueado.
 */
export async function GET(request: Request) {
  const secreto = process.env.CRON_SECRET;
  const autorizacion = request.headers.get("authorization");
  const esCron = Boolean(secreto) && autorizacion === `Bearer ${secreto}`;

  let supabase: ReturnType<typeof createClient<Database>> | Awaited<
    ReturnType<typeof crearClienteServidor>
  >;

  if (esCron) {
    // Sin sesión de usuario: corre con permisos de servidor.
    const admin = crearClienteAdmin();
    if (!admin) {
      return Response.json(
        { error: "Falta configurar SUPABASE_SERVICE_ROLE_KEY." },
        { status: 500 },
      );
    }
    supabase = admin;
  } else {
    supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return new Response("No autorizado", { status: 401 });
  }

  try {
    const resumen = await sincronizarICal(supabase);
    return Response.json(resumen);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Falló la sincronización." },
      { status: 500 },
    );
  }
}
