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
