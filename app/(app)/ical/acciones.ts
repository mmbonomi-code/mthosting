"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { sincronizarICal, type ResumenSync } from "@/lib/ical/sincronizar";

export type EstadoSync =
  | { resultado: "ok"; resumen: ResumenSync }
  | { resultado: "error"; error: string }
  | null;

/** El estado previo lo pasa useActionState; acá no hace falta mirarlo. */
export async function sincronizarAhora(deptoId?: string): Promise<EstadoSync> {
  const supabase = await crearClienteServidor();

  try {
    const resumen = await sincronizarICal(supabase, deptoId);
    revalidatePath("/ical");
    revalidatePath("/semana");
    revalidatePath("/dia");
    return { resultado: "ok", resumen };
  } catch (error) {
    return {
      resultado: "error",
      error: error instanceof Error ? error.message : "Falló la sincronización.",
    };
  }
}
