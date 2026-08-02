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
    banos: entero(fd, "banos"),
    capacidad: entero(fd, "capacidad"),
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

// --- Distribución: camas por ambiente ---

type TipoCama = Database["public"]["Enums"]["tipo_cama"];

export async function agregarCama(
  deptoId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const ambiente = texto(fd, "ambiente");
  const tipoCama = texto(fd, "tipo_cama") as TipoCama | null;
  const cantidad = entero(fd, "cantidad") ?? 1;

  if (!ambiente || !tipoCama) {
    return { error: "Indicá el ambiente y el tipo de cama." };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("distribucion_depto").insert({
    depto_id: deptoId,
    ambiente,
    tipo_cama: tipoCama,
    cantidad,
  });

  if (error) return { error: "No se pudo agregar. Probá de nuevo." };

  revalidatePath(`/departamentos/${deptoId}`);
  return null;
}

/** Las filas de distribución son datos maestros de la ficha, no operativos:
 *  quitar una cama mal cargada es una corrección, no una baja. */
export async function quitarCama(filaId: string, deptoId: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("distribucion_depto").delete().eq("id", filaId);
  revalidatePath(`/departamentos/${deptoId}`);
}

// --- Inventario del departamento ---

export async function agregarInventario(
  deptoId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const nombreItem = texto(fd, "item_nombre");
  const cantidad = entero(fd, "cantidad") ?? 1;
  const notas = texto(fd, "notas");

  if (!nombreItem) {
    return { error: "Escribí qué ítem querés agregar (ej.: Plancha, AAC…)." };
  }

  const supabase = await crearClienteServidor();

  // Busca el ítem en el catálogo; si no existe, lo crea.
  const { data: existente } = await supabase
    .from("item_catalogo")
    .select("id")
    .ilike("nombre", nombreItem)
    .maybeSingle();

  let itemId = existente?.id;
  if (!itemId) {
    const { data: creado, error: errorCatalogo } = await supabase
      .from("item_catalogo")
      .insert({ nombre: nombreItem })
      .select("id")
      .single();
    if (errorCatalogo) {
      return { error: "No se pudo crear el ítem en el catálogo." };
    }
    itemId = creado.id;
  }

  // Si el depto ya tiene ese ítem, actualiza la cantidad; si no, lo agrega.
  const { data: filaExistente } = await supabase
    .from("inventario_depto")
    .select("id")
    .eq("depto_id", deptoId)
    .eq("item_id", itemId)
    .maybeSingle();

  const { error } = filaExistente
    ? await supabase
        .from("inventario_depto")
        .update({ cantidad, notas })
        .eq("id", filaExistente.id)
    : await supabase
        .from("inventario_depto")
        .insert({ depto_id: deptoId, item_id: itemId, cantidad, notas });

  if (error) return { error: "No se pudo guardar el inventario." };

  revalidatePath(`/departamentos/${deptoId}`);
  return null;
}

export async function quitarInventario(filaId: string, deptoId: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("inventario_depto").delete().eq("id", filaId);
  revalidatePath(`/departamentos/${deptoId}`);
}
