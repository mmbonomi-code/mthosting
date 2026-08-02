"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export type EstadoFormulario = { error: string } | null;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function datosPropietario(fd: FormData) {
  return {
    nombre: String(fd.get("nombre") ?? "").trim(),
    contacto: texto(fd, "contacto"),
    fecha_nacimiento: texto(fd, "fecha_nacimiento"),
    cuenta_cobro: texto(fd, "cuenta_cobro"),
    datos_bancarios: texto(fd, "datos_bancarios"),
    activo: fd.get("activo") === "on",
  };
}

export async function crearPropietario(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPropietario(fd);
  if (!datos.nombre) return { error: "El nombre es obligatorio." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("propietarios").insert(datos);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/propietarios");
  redirect("/propietarios");
}

export async function actualizarPropietario(
  id: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPropietario(fd);
  if (!datos.nombre) return { error: "El nombre es obligatorio." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("propietarios")
    .update(datos)
    .eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/propietarios");
  redirect("/propietarios");
}
