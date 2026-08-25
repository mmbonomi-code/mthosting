"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = { error: string } | null;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

// --- Checklist fijo -----------------------------------------------------

function datosItem(fd: FormData) {
  return {
    seccion: texto(fd, "seccion"),
    item: texto(fd, "item"),
    activo: fd.get("activo") === "on",
  };
}

export async function crearItemChecklist(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosItem(fd);
  if (!datos.seccion || !datos.item) {
    return { error: "La sección y el ítem son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const { count } = await supabase
    .from("checklist_catalogo")
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from("checklist_catalogo").insert({
    seccion: datos.seccion,
    item: datos.item,
    activo: datos.activo,
    orden: ((count ?? 0) + 1) * 10,
  });
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/checklist-limpieza");
  redirect("/checklist-limpieza");
}

export async function actualizarItemChecklist(
  id: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosItem(fd);
  if (!datos.seccion || !datos.item) {
    return { error: "La sección y el ítem son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("checklist_catalogo")
    .update({ seccion: datos.seccion, item: datos.item, activo: datos.activo })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/checklist-limpieza");
  redirect("/checklist-limpieza");
}

/**
 * Sube o baja un ítem DENTRO de su sección. Cambiar de sección es una
 * recategorización — se hace editando el ítem, no con las flechas.
 */
export async function moverItemChecklist(id: string, direccion: "arriba" | "abajo") {
  const supabase = await crearClienteServidor();

  const { data: actual } = await supabase
    .from("checklist_catalogo")
    .select("seccion")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return;

  const { data: items } = await supabase
    .from("checklist_catalogo")
    .select("id, orden")
    .eq("seccion", actual.seccion)
    .order("orden");
  if (!items) return;

  const posicion = items.findIndex((i) => i.id === id);
  const vecino = direccion === "arriba" ? posicion - 1 : posicion + 1;
  if (posicion === -1 || vecino < 0 || vecino >= items.length) return;

  const reordenados = [...items];
  [reordenados[posicion], reordenados[vecino]] = [reordenados[vecino], reordenados[posicion]];

  await Promise.all(
    reordenados.map((i, idx) =>
      supabase.from("checklist_catalogo").update({ orden: (idx + 1) * 10 }).eq("id", i.id),
    ),
  );

  revalidatePath("/checklist-limpieza");
}

// --- Tareas periódicas ----------------------------------------------------

function datosPeriodica(fd: FormData) {
  const frecuencia = Number.parseInt(String(fd.get("frecuencia_dias") ?? ""), 10);
  return {
    item: texto(fd, "item"),
    frecuencia_dias: Number.isFinite(frecuencia) ? frecuencia : null,
    activo: fd.get("activo") === "on",
  };
}

export async function crearTareaPeriodica(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPeriodica(fd);
  if (!datos.item) return { error: "El nombre de la tarea es obligatorio." };
  if (!datos.frecuencia_dias || datos.frecuencia_dias < 1) {
    return { error: "La frecuencia tiene que ser un número de días mayor a cero." };
  }

  const supabase = await crearClienteServidor();
  const { count } = await supabase
    .from("tareas_periodicas_catalogo")
    .select("id", { count: "exact", head: true });

  const { error } = await supabase.from("tareas_periodicas_catalogo").insert({
    item: datos.item,
    frecuencia_dias: datos.frecuencia_dias,
    activo: datos.activo,
    orden: ((count ?? 0) + 1) * 10,
  });
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/checklist-limpieza");
  redirect("/checklist-limpieza");
}

export async function actualizarTareaPeriodica(
  id: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPeriodica(fd);
  if (!datos.item) return { error: "El nombre de la tarea es obligatorio." };
  if (!datos.frecuencia_dias || datos.frecuencia_dias < 1) {
    return { error: "La frecuencia tiene que ser un número de días mayor a cero." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("tareas_periodicas_catalogo")
    .update({ item: datos.item, frecuencia_dias: datos.frecuencia_dias, activo: datos.activo })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/checklist-limpieza");
  redirect("/checklist-limpieza");
}

export async function moverTareaPeriodica(id: string, direccion: "arriba" | "abajo") {
  const supabase = await crearClienteServidor();

  const { data: tareas } = await supabase
    .from("tareas_periodicas_catalogo")
    .select("id, orden")
    .order("orden");
  if (!tareas) return;

  const posicion = tareas.findIndex((t) => t.id === id);
  const vecino = direccion === "arriba" ? posicion - 1 : posicion + 1;
  if (posicion === -1 || vecino < 0 || vecino >= tareas.length) return;

  const reordenadas = [...tareas];
  [reordenadas[posicion], reordenadas[vecino]] = [reordenadas[vecino], reordenadas[posicion]];

  await Promise.all(
    reordenadas.map((t, idx) =>
      supabase.from("tareas_periodicas_catalogo").update({ orden: (idx + 1) * 10 }).eq("id", t.id),
    ),
  );

  revalidatePath("/checklist-limpieza");
}
