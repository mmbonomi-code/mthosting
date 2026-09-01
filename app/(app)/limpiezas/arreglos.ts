"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ARREGLO_RESUELTO } from "@/lib/alertas/detectar";

/**
 * Da por resuelto un arreglo que reportó la limpieza.
 *
 * Es lo único que apaga su alerta roja. No se borra la fila: queda el
 * historial de que ese departamento tuvo ese problema y cuándo se resolvió
 * (CLAUDE.md: nada de DELETE físico sobre datos operativos).
 */
export async function resolverArreglo(id: string, limpiezaId: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("arreglos").update({ estado: ARREGLO_RESUELTO }).eq("id", id);
  revalidatePath(`/limpiezas/${limpiezaId}`);
  revalidatePath("/alertas");
}

/** Vuelve a abrirlo: se dio por resuelto y no lo estaba. */
export async function reabrirArreglo(id: string, limpiezaId: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("arreglos").update({ estado: "pendiente" }).eq("id", id);
  revalidatePath(`/limpiezas/${limpiezaId}`);
  revalidatePath("/alertas");
}
