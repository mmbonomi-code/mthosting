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

/**
 * Da por revisada una alerta que nace de las fotos de la limpieza: un daño
 * que no da para reclamo, o un olvido que ya se resolvió con el huésped.
 *
 * Mismo criterio que arriba: se guarda QUÉ se revisó (cuántas fotos había y
 * cuál era la última). Si la limpieza suma otra foto, la firma cambia y la
 * alerta vuelve sola. Con un "ya está" a secas, la segunda foto quedaría
 * invisible para siempre.
 */
export async function marcarRevisada(clase: string, limpiezaId: string, firma: string) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: persona } = user
    ? await supabase.from("personas").select("id").eq("profile_id", user.id).maybeSingle()
    : { data: null };

  await supabase.from("alerta_revisada").upsert(
    {
      clase,
      limpieza_id: limpiezaId,
      firma,
      revisada_por: persona?.id ?? null,
    },
    { onConflict: "clase,limpieza_id" },
  );
  revalidatePath("/alertas");
}
