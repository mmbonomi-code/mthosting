"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = { error: string } | { ok: true } | null;

const CLAVES = [
  "hora_limite_checkout",
  "hora_minima_checkin",
  "dia_corte_semana_pago",
] as const;

export async function guardarParametros(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();

  for (const clave of CLAVES) {
    const valor = String(fd.get(clave) ?? "").trim();
    if (!valor) continue;
    const { error } = await supabase
      .from("parametros_operativos")
      .update({ valor })
      .eq("clave", clave);
    if (error) return { error: `No se pudo guardar ${clave}.` };
  }

  revalidatePath("/parametros");
  return { ok: true };
}
