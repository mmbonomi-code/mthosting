"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Ambientes = Database["public"]["Enums"]["ambientes_tipo"];
type SelfCheckout = Database["public"]["Enums"]["self_checkout_tipo"];
type EstadoDepto = Database["public"]["Enums"]["depto_estado"];
type Canal = Database["public"]["Enums"]["canal_tipo"];

export type EstadoFormulario = { error: string } | null;

/** Campo de texto del formulario: recortado, y vacío se guarda como null. */
function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function entero(fd: FormData, campo: string): number | null {
  const valor = texto(fd, campo);
  if (valor === null) return null;
  const numero = Number.parseInt(valor, 10);
  return Number.isNaN(numero) ? null : numero;
}

function marcado(fd: FormData, campo: string): boolean {
  return fd.get(campo) === "on";
}

function datosDepartamento(fd: FormData) {
  return {
    codigo: String(fd.get("codigo") ?? "")
      .trim()
      .toUpperCase(),
    nombre_interno: String(fd.get("nombre_interno") ?? "").trim(),
    propietario_id: texto(fd, "propietario_id"),
    estado: (texto(fd, "estado") ?? "activo") as EstadoDepto,
    direccion: texto(fd, "direccion"),
    barrio: texto(fd, "barrio"),
    ambientes: texto(fd, "ambientes") as Ambientes | null,
    habitaciones: entero(fd, "habitaciones"),
    capacidad: entero(fd, "capacidad"),
    camas_king: entero(fd, "camas_king") ?? 0,
    camas_queen: entero(fd, "camas_queen") ?? 0,
    camas_twin: entero(fd, "camas_twin") ?? 0,
    sillon_cama: entero(fd, "sillon_cama") ?? 0,
    bano_1: texto(fd, "bano_1"),
    bano_2: texto(fd, "bano_2"),
    bano_3: texto(fd, "bano_3"),
    comision_pct: (() => {
      const valor = texto(fd, "comision_pct");
      return valor === null ? null : Number.parseFloat(valor);
    })(),
    wifi_ssid: texto(fd, "wifi_ssid"),
    wifi_pass: texto(fd, "wifi_pass"),
    airbnb_user: texto(fd, "airbnb_user"),
    airbnb_pass: texto(fd, "airbnb_pass"),
    url_publicacion: texto(fd, "url_publicacion"),
    url_mapa: texto(fd, "url_mapa"),
    ical_url: texto(fd, "ical_url"),
    encargado_nombre: texto(fd, "encargado_nombre"),
    encargado_telefono: texto(fd, "encargado_telefono"),
    propietario_telefono: texto(fd, "propietario_telefono"),
    self_checkout: (texto(fd, "self_checkout") ?? "no") as SelfCheckout,
    requiere_registro: marcado(fd, "requiere_registro"),
    requiere_aviso_seguridad: marcado(fd, "requiere_aviso_seguridad"),
    indicaciones_acceso: texto(fd, "indicaciones_acceso"),
    trabajo_verificado: marcado(fd, "trabajo_verificado"),
    observacion: texto(fd, "observacion"),
    activo: marcado(fd, "activo"),
  };
}

export async function crearDepartamento(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosDepartamento(fd);

  if (!datos.codigo || !datos.nombre_interno) {
    return { error: "El código y el nombre interno son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("departamentos")
    .insert(datos)
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un departamento con el código ${datos.codigo}.` };
    }
    return { error: "No se pudo guardar. Probá de nuevo." };
  }

  revalidatePath("/departamentos");
  redirect(`/departamentos/${data.id}`);
}

export async function actualizarDepartamento(
  id: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosDepartamento(fd);

  if (!datos.codigo || !datos.nombre_interno) {
    return { error: "El código y el nombre interno son obligatorios." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("departamentos")
    .update(datos)
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: `Ya existe un departamento con el código ${datos.codigo}.` };
    }
    return { error: "No se pudo guardar. Probá de nuevo." };
  }

  revalidatePath("/departamentos");
  revalidatePath(`/departamentos/${id}`);
  redirect(`/departamentos/${id}`);
}

// --- Anuncios vinculados (listing_alias) ---

export async function agregarAlias(
  deptoId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const canal = (texto(fd, "canal") ?? "airbnb") as Canal;
  const nombreListing = texto(fd, "nombre_listing");

  if (!nombreListing) {
    return { error: "Escribí el nombre del anuncio tal como aparece en el canal." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("listing_alias").insert({
    depto_id: deptoId,
    canal,
    nombre_listing: nombreListing,
  });

  if (error) {
    if (error.code === "23505") {
      return {
        error:
          "Ese nombre de anuncio ya está vinculado (puede estar en otro departamento).",
      };
    }
    return { error: "No se pudo agregar el anuncio. Probá de nuevo." };
  }

  revalidatePath(`/departamentos/${deptoId}`);
  return null;
}

/** Baja/alta lógica del alias. Nunca se borra: el histórico de imports lo referencia. */
export async function alternarAlias(
  aliasId: string,
  deptoId: string,
  activo: boolean,
) {
  const supabase = await crearClienteServidor();
  await supabase
    .from("listing_alias")
    .update({ activo })
    .eq("id", aliasId);
  revalidatePath(`/departamentos/${deptoId}`);
}

// --- Equipamiento: tiene / no tiene + detalle, contra el catálogo de ítems ---

/**
 * Guarda el equipamiento del departamento. Los campos llegan como
 * `tiene_<itemId>` (casilla) y `detalle_<itemId>` (texto libre).
 * Se guarda la fila solo si el ítem está marcado o tiene detalle cargado:
 * un ítem nunca marcado no ensucia la tabla con filas vacías.
 */
export async function guardarEquipamiento(
  deptoId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();

  const { data: items } = await supabase.from("item_catalogo").select("id");
  if (!items) return { error: "No se pudo leer el catálogo de ítems." };

  const aGuardar: {
    depto_id: string;
    item_id: string;
    tiene: boolean;
    detalle: string | null;
  }[] = [];
  const aBorrar: string[] = [];

  for (const item of items) {
    const tiene = fd.get(`tiene_${item.id}`) === "on";
    const detalle = texto(fd, `detalle_${item.id}`);
    if (tiene || detalle !== null) {
      aGuardar.push({
        depto_id: deptoId,
        item_id: item.id,
        tiene,
        detalle,
      });
    } else {
      aBorrar.push(item.id);
    }
  }

  if (aGuardar.length > 0) {
    const { error } = await supabase
      .from("inventario_depto")
      .upsert(aGuardar, { onConflict: "depto_id,item_id" });
    if (error) return { error: "No se pudo guardar el equipamiento." };
  }

  if (aBorrar.length > 0) {
    await supabase
      .from("inventario_depto")
      .delete()
      .eq("depto_id", deptoId)
      .in("item_id", aBorrar);
  }

  revalidatePath(`/departamentos/${deptoId}`);
  redirect(`/departamentos/${deptoId}`);
}
