"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BUCKET, type EstadoFormulario } from "./tipos";

const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp", "image/heic"];
const TAMANIO_MAXIMO = 15 * 1024 * 1024;

/** Empieza la limpieza: la única forma de que pase a "en curso". */
export async function iniciarLimpieza(id: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("limpiezas").update({ estado: "en_curso" }).eq("id", id);
  revalidatePath(`/mis-limpiezas/${id}`);
  revalidatePath("/mis-limpiezas");
}

/** Tilda o destilda un ítem del checklist de ESTA limpieza. */
export async function tildarChecklistItem(limpiezaId: string, filaId: string, hecho: boolean) {
  const supabase = await crearClienteServidor();
  await supabase.from("limpieza_checklist").update({ hecho }).eq("id", filaId);
  revalidatePath(`/mis-limpiezas/${limpiezaId}`);
}

/**
 * Sube una o más fotos de una categoría (terminado / arreglar / huésped) al
 * bucket privado. Se sirven siempre por URL firmada, nunca por link público.
 */
export async function subirFotos(
  limpiezaId: string,
  tipo: "terminado" | "arreglar" | "huesped",
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const archivos = fd.getAll("archivos").filter((a): a is File => a instanceof File);
  if (archivos.length === 0) return { error: "No elegiste ningún archivo." };

  const rechazados: string[] = [];

  for (const archivo of archivos) {
    if (archivo.size === 0) continue;
    if (archivo.size > TAMANIO_MAXIMO) {
      rechazados.push(`${archivo.name} (pesa más de 15 MB)`);
      continue;
    }
    if (!TIPOS_ACEPTADOS.includes(archivo.type)) {
      rechazados.push(`${archivo.name} (no es una imagen)`);
      continue;
    }

    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const ruta = `${limpiezaId}/${tipo}/${crypto.randomUUID()}.${extension}`;

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
    if (errorSubida) {
      rechazados.push(`${archivo.name} (${errorSubida.message})`);
      continue;
    }

    await supabase.from("limpieza_fotos").insert({
      limpieza_id: limpiezaId,
      storage_path: ruta,
      tipo,
    });
  }

  revalidatePath(`/mis-limpiezas/${limpiezaId}`);
  // Back office sube fotos desde la ficha de la limpieza, no desde "Mis
  // limpiezas" (spec Fase 2 §3): esa pantalla también tiene que refrescar.
  revalidatePath(`/limpiezas/${limpiezaId}`);
  if (rechazados.length > 0) return { error: `No se pudieron subir: ${rechazados.join(", ")}.` };
  return { ok: "Fotos guardadas." };
}

/** La nota que le queda a quien limpie este depto la próxima vez. */
export async function guardarObservacionProxima(id: string, texto: string) {
  const supabase = await crearClienteServidor();
  await supabase
    .from("limpiezas")
    .update({ observacion_proxima: texto.trim() === "" ? null : texto.trim() })
    .eq("id", id);
  revalidatePath(`/mis-limpiezas/${id}`);
}

/**
 * Reporta algo para arreglar: crea un arreglo asociado a la limpieza (spec
 * Fase 2 §2.7), no un comentario suelto.
 */
export async function crearArreglo(
  limpiezaId: string,
  deptoId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const descripcion = String(fd.get("descripcion") ?? "").trim();
  if (!descripcion) return { error: "Contá qué hay que arreglar." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("arreglos").insert({
    depto_id: deptoId,
    limpieza_id: limpiezaId,
    descripcion,
    estado: "pendiente",
  });
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath(`/mis-limpiezas/${limpiezaId}`);
  return { ok: "Arreglo reportado." };
}

/** Monto del viático. El comprobante se sube aparte, con `subirComprobanteViatico`. */
export async function guardarViaticoMonto(id: string, monto: string) {
  const supabase = await crearClienteServidor();
  const valor = Number.parseFloat(monto.replace(",", "."));
  await supabase
    .from("limpiezas")
    .update({ viatico_monto: Number.isFinite(valor) && valor > 0 ? valor : null })
    .eq("id", id);
  revalidatePath(`/mis-limpiezas/${id}`);
}

export async function subirComprobanteViatico(
  limpiezaId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const archivo = fd.get("comprobante");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { error: "No elegiste ningún archivo." };
  }
  if (archivo.size > TAMANIO_MAXIMO) return { error: "Pesa más de 15 MB." };
  if (!TIPOS_ACEPTADOS.includes(archivo.type)) return { error: "Tiene que ser una imagen." };

  const supabase = await crearClienteServidor();
  const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const ruta = `${limpiezaId}/viatico/${crypto.randomUUID()}.${extension}`;

  const { error: errorSubida } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
  if (errorSubida) return { error: `No se pudo subir: ${errorSubida.message}` };

  const { error } = await supabase
    .from("limpiezas")
    .update({ viatico_comprobante: ruta })
    .eq("id", limpiezaId);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath(`/mis-limpiezas/${limpiezaId}`);
  return { ok: "Comprobante guardado." };
}

/**
 * Marca la limpieza como terminada. Exige al menos una foto del depto
 * terminado — se revisa acá, no solo en el cliente: es la única condición
 * dura del flujo (spec §10, "en proceso → completada requiere al menos una
 * foto").
 */
export async function finalizarLimpieza(
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _estadoPrevio: EstadoFormulario,
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();

  const { count } = await supabase
    .from("limpieza_fotos")
    .select("id", { count: "exact", head: true })
    .eq("limpieza_id", id)
    .eq("tipo", "terminado");
  if (!count) {
    return { error: "Hace falta al menos una foto del departamento terminado." };
  }

  const { error } = await supabase.from("limpiezas").update({ estado: "hecha" }).eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/mis-limpiezas");
  redirect("/mis-limpiezas");
}
