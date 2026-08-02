"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type ModalidadPago = Database["public"]["Enums"]["modalidad_pago"];
type Rol = Database["public"]["Enums"]["rol_usuario"];

export type EstadoFormulario = { error: string } | null;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function datosPersona(fd: FormData) {
  return {
    nombre: String(fd.get("nombre") ?? "").trim(),
    telefono: texto(fd, "telefono"),
    hace_limpieza: fd.get("hace_limpieza") === "on",
    hace_checkin: fd.get("hace_checkin") === "on",
    es_backoffice: fd.get("es_backoffice") === "on",
    modalidad_pago: texto(fd, "modalidad_pago") as ModalidadPago | null,
    rol: texto(fd, "rol") as Rol | null,
    activo: fd.get("activo") === "on",
  };
}

export async function crearPersona(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPersona(fd);
  if (!datos.nombre) return { error: "El nombre es obligatorio." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("personas").insert(datos);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/personas");
  redirect("/personas");
}

export async function actualizarPersona(
  id: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPersona(fd);
  if (!datos.nombre) return { error: "El nombre es obligatorio." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("personas").update(datos).eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/personas");
  redirect("/personas");
}
