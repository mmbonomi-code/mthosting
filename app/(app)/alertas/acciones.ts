"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Da por revisado un conflicto de cancelación / cambio de fecha (spec §3.6,
 * lista 4).
 *
 * Guarda la FIRMA de lo que se revisó, no un "ya está". Si la reserva vuelve
 * a moverse, la firma nueva no coincide con la guardada y el aviso reaparece
 * solo: dar por bueno un cambio al 15/09 no tapa un segundo cambio al 20/09.
 */
export async function resolverConflicto(limpiezaId: string, firma: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("limpiezas").update({ conflicto_resuelto: firma }).eq("id", limpiezaId);
  revalidatePath("/alertas");
}
