"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { mapearAnuncio } from "@/lib/importador/bandeja";

export type EstadoMapeo =
  | { resultado: "ok"; asignadas: number; limpiezas: number }
  | { resultado: "error"; error: string }
  | null;

export async function vincularAnuncio(
  nombreListing: string,
  _estadoPrevio: EstadoMapeo,
  formData: FormData,
): Promise<EstadoMapeo> {
  const deptoId = String(formData.get("depto_id") ?? "").trim();
  if (!deptoId) {
    return { resultado: "error", error: "Elegí un departamento." };
  }

  const supabase = await crearClienteServidor();

  try {
    const { reservasAsignadas, limpiezasGeneradas } = await mapearAnuncio(
      supabase,
      nombreListing,
      deptoId,
    );
    revalidatePath("/bandeja");
    revalidatePath("/departamentos");
    // El día y las limpiezas cambian: la reserva recién ahora tiene sus
    // eventos y aparece en las pantallas de trabajo.
    revalidatePath("/dia");
    revalidatePath("/semana");
    return {
      resultado: "ok",
      asignadas: reservasAsignadas,
      limpiezas: limpiezasGeneradas,
    };
  } catch (error) {
    return {
      resultado: "error",
      error: error instanceof Error ? error.message : "No se pudo vincular el anuncio.",
    };
  }
}
