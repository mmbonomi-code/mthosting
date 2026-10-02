"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BUCKET_LOGISTICA } from "@/lib/logistica/storage";
import type { EstadoEquipamiento } from "@/lib/reporte/equipamiento";

export type Resultado = { error: string } | null;

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const TAMANIO_MAXIMO = 15 * 1024 * 1024;

/**
 * Todo lo que marca logística pasa por funciones de la base que tocan solo
 * esa columna (migración 20261002100100_logistica.sql). Ahí está también el
 * control de quién puede: si el rol no corresponde, la base contesta con el
 * error y se muestra tal cual.
 */

/** "Dejé lo blanco" / "Saqué lo sucio" en una limpieza. */
export async function marcarRopa(
  limpiezaId: string,
  que: "blanco" | "sucio",
  valor: boolean,
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("logistica_marcar_ropa", {
    p_limpieza: limpiezaId,
    p_que: que,
    p_valor: valor,
  });
  if (error) return { error: error.message };
  revalidatePath("/logistica");
  return null;
}

/** Cuna o silla entregada / retirada, o deshacer la marca. */
export async function marcarEquipamiento(
  id: string,
  estado: EstadoEquipamiento,
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("logistica_marcar_equipamiento", {
    p_id: id,
    p_estado: estado,
  });
  if (error) return { error: error.message };
  revalidatePath("/logistica");
  // El Día y el Reporte muestran el mismo pedido.
  revalidatePath("/dia");
  revalidatePath("/reporte");
  return null;
}

/**
 * La llave quedó en el candado. La foto llega ya achicada desde el celular;
 * se sube al bucket privado y recién entonces se marca. Sin foto no se marca.
 */
export async function dejarLlave(eventoId: string, fd: FormData): Promise<Resultado> {
  const archivo = fd.get("foto");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "Falta la foto de la llave en el candado." };
  }
  if (archivo.size > TAMANIO_MAXIMO) return { error: "La foto pesa más de 15 MB." };
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) return { error: "El archivo no es una foto." };

  const supabase = await crearClienteServidor();
  const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
  const ruta = `llaves/${eventoId}/${crypto.randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET_LOGISTICA)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (errorSubida) return { error: `No se pudo subir la foto: ${errorSubida.message}` };

  const { error } = await supabase.rpc("logistica_dejar_llave", {
    p_evento: eventoId,
    p_foto: ruta,
  });
  if (error) {
    // La marca no se guardó: la foto suelta no le sirve a nadie.
    await supabase.storage.from(BUCKET_LOGISTICA).remove([ruta]);
    return { error: error.message };
  }

  revalidatePath("/logistica");
  revalidatePath("/dia", "layout");
  return null;
}

export async function deshacerLlave(eventoId: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("logistica_deshacer_llave", { p_evento: eventoId });
  if (error) return { error: error.message };
  revalidatePath("/logistica");
  revalidatePath("/dia", "layout");
  return null;
}
