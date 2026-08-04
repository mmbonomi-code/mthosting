"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type MetodoAcceso = Database["public"]["Enums"]["metodo_acceso"];

export type EstadoFormulario = { error: string } | null;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function datosPunto(fd: FormData) {
  return {
    metodo: (texto(fd, "metodo") ?? "sobre") as MetodoAcceso,
    ubicacion: texto(fd, "ubicacion"),
    identificador: texto(fd, "identificador"),
    instrucciones: texto(fd, "instrucciones"),
    sirve_checkin: fd.get("sirve_checkin") === "on",
    sirve_checkout: fd.get("sirve_checkout") === "on",
    activo: fd.get("activo") === "on",
  };
}

export async function crearPuntoAcceso(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPunto(fd);
  if (!datos.ubicacion) return { error: "La ubicación es obligatoria." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("puntos_acceso").insert(datos);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/puntos-acceso");
  redirect("/puntos-acceso");
}

/**
 * Sube o baja un punto de acceso en la lista. El orden define cómo se
 * ofrecen al coordinar: arriba los que más se usan.
 */
export async function moverPuntoAcceso(id: string, direccion: "arriba" | "abajo") {
  const supabase = await crearClienteServidor();

  const { data: puntos } = await supabase
    .from("puntos_acceso")
    .select("id, orden")
    .order("orden")
    .order("ubicacion");
  if (!puntos) return;

  const posicion = puntos.findIndex((p) => p.id === id);
  const vecino = direccion === "arriba" ? posicion - 1 : posicion + 1;
  if (posicion === -1 || vecino < 0 || vecino >= puntos.length) return;

  // Se intercambian las posiciones, renumerando de 10 en 10 para que
  // siempre haya lugar entre medio.
  const reordenados = [...puntos];
  [reordenados[posicion], reordenados[vecino]] = [
    reordenados[vecino],
    reordenados[posicion],
  ];

  await Promise.all(
    reordenados.map((p, i) =>
      supabase.from("puntos_acceso").update({ orden: (i + 1) * 10 }).eq("id", p.id),
    ),
  );

  revalidatePath("/puntos-acceso");
  revalidatePath("/dia");
}

export async function actualizarPuntoAcceso(
  id: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPunto(fd);
  if (!datos.ubicacion) return { error: "La ubicación es obligatoria." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("puntos_acceso").update(datos).eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/puntos-acceso");
  redirect("/puntos-acceso");
}
