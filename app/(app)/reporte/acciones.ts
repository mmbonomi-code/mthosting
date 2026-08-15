"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribirReporte } from "@/lib/reporte/permisos";
import type { EstadoFormulario } from "@/lib/reporte/tipos";
import type { Database } from "@/lib/database.types";

type Seccion = Database["public"]["Enums"]["reporte_seccion"];
type TipoEquipamiento = Database["public"]["Enums"]["equipamiento_tipo"];
type EstadoEquipamiento = Database["public"]["Enums"]["equipamiento_estado"];

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

async function conPermiso() {
  const supabase = await crearClienteServidor();
  if (!(await puedeEscribirReporte(supabase))) return null;
  return supabase;
}

/**
 * Alta de un anuncio o de un pendiente. El título es lo único obligatorio:
 * anotar rápido tiene que ser posible, y lo demás se completa después.
 */
export async function crearNota(
  seccion: Seccion,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "No tenés permiso para escribir en el reporte." };

  const titulo = texto(fd, "titulo");
  if (!titulo) return { error: "Escribí de qué se trata." };

  const fecha = texto(fd, "fecha");
  const fechaHasta = texto(fd, "fecha_hasta");
  if (fecha && fechaHasta && fechaHasta < fecha) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio." };
  }

  const { error } = await supabase.from("notas_reporte").insert({
    seccion,
    titulo,
    detalle: texto(fd, "detalle"),
    fecha,
    fecha_hasta: fechaHasta,
    depto_id: texto(fd, "depto_id"),
    responsable_id: texto(fd, "responsable_id"),
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/reporte");
  revalidatePath("/dia");
  return { ok: "Anotado." };
}

/** Edición de una nota ya cargada. */
export async function editarNota(
  id: string,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "No tenés permiso para escribir en el reporte." };

  const titulo = texto(fd, "titulo");
  if (!titulo) return { error: "Escribí de qué se trata." };

  const fecha = texto(fd, "fecha");
  const fechaHasta = texto(fd, "fecha_hasta");
  if (fecha && fechaHasta && fechaHasta < fecha) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio." };
  }

  const { error } = await supabase
    .from("notas_reporte")
    .update({
      titulo,
      detalle: texto(fd, "detalle"),
      fecha,
      fecha_hasta: fechaHasta,
      depto_id: texto(fd, "depto_id"),
      responsable_id: texto(fd, "responsable_id"),
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/reporte");
  revalidatePath("/dia");
  return { ok: "Guardado." };
}

/**
 * Marca hecho o vuelve a pendiente. Lo hecho no se borra: sale de la lista
 * pero queda, con quién lo resolvió y cuándo (CLAUDE.md, regla 3).
 */
export async function alternarHecho(id: string, hecho: boolean) {
  const supabase = await conPermiso();
  if (!supabase) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("notas_reporte")
    .update(
      hecho
        ? { estado: "hecho", hecho_at: new Date().toISOString(), hecho_por: user?.id }
        : { estado: "pendiente", hecho_at: null, hecho_por: null },
    )
    .eq("id", id);

  revalidatePath("/reporte");
  revalidatePath("/dia");
}

/** Saca la nota de circulación sin borrarla. */
export async function archivarNota(id: string) {
  const supabase = await conPermiso();
  if (!supabase) return;

  await supabase.from("notas_reporte").update({ activo: false }).eq("id", id);
  revalidatePath("/reporte");
  revalidatePath("/dia");
}

// --- Cunas, sillas y bañaderas ----------------------------------------------

/**
 * Alta de un pedido de equipamiento. Se puede colgar de una reserva —y el
 * departamento y las fechas salen de ahí— o cargarse suelto con departamento
 * y fechas a mano.
 */
export async function crearEquipamiento(fd: FormData): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "No tenés permiso para escribir en el reporte." };

  const tipo = texto(fd, "tipo") as TipoEquipamiento | null;
  if (!tipo) return { error: "Elegí si es cuna, silla o bañadera." };

  const reservaId = texto(fd, "reserva_id");
  let deptoId = texto(fd, "depto_id");
  let desde = texto(fd, "fecha_desde");
  let hasta = texto(fd, "fecha_hasta");

  // Colgado de una reserva, el departamento y las fechas se toman de ella:
  // son un dato, no algo para volver a escribir.
  if (reservaId) {
    const { data: reserva } = await supabase
      .from("reservas")
      .select("depto_id, fecha_checkin, fecha_checkout")
      .eq("id", reservaId)
      .maybeSingle();
    if (!reserva) return { error: "No se encontró esa reserva." };
    deptoId = reserva.depto_id;
    desde = desde ?? reserva.fecha_checkin;
    hasta = hasta ?? reserva.fecha_checkout;
  }

  if (!desde || !hasta) return { error: "Faltan las fechas de desde y hasta." };
  if (hasta < desde) return { error: "El hasta no puede ser anterior al desde." };
  if (!reservaId && !deptoId) {
    return { error: "Elegí una reserva o, si no corresponde a ninguna, un departamento." };
  }

  const { error } = await supabase.from("equipamiento_bebe").insert({
    tipo,
    reserva_id: reservaId,
    depto_id: deptoId,
    fecha_desde: desde,
    fecha_hasta: hasta,
    notas: texto(fd, "notas"),
  });

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/reporte");
  revalidatePath("/dia");
  return { ok: "Anotado." };
}

/**
 * Corregir lo que se anotó: el tipo, las fechas y las notas.
 *
 * Hacía falta porque una vez cargado no se podía tocar nada, y lo que más
 * cambia son justamente las fechas: el huésped se queda un día más y la cuna
 * con él. La única salida era archivar y volver a cargar, que pierde el
 * estado de entrega.
 *
 * El departamento se puede cambiar solo cuando el pedido NO cuelga de una
 * reserva. Si cuelga, el departamento es el de la reserva y cambiarlo por
 * separado los dejaría diciendo cosas distintas.
 */
export async function editarEquipamiento(
  id: string,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "No tenés permiso para escribir en el reporte." };

  const tipo = texto(fd, "tipo") as TipoEquipamiento | null;
  const desde = texto(fd, "fecha_desde");
  const hasta = texto(fd, "fecha_hasta");

  if (!tipo) return { error: "Elegí si es cuna, silla o bañadera." };
  if (!desde || !hasta) return { error: "Faltan las fechas de desde y hasta." };
  if (hasta < desde) return { error: "El hasta no puede ser anterior al desde." };

  const { data: actual } = await supabase
    .from("equipamiento_bebe")
    .select("reserva_id")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return { error: "No se encontró el pedido." };

  const cambios: {
    tipo: TipoEquipamiento;
    fecha_desde: string;
    fecha_hasta: string;
    notas: string | null;
    depto_id?: string;
  } = {
    tipo,
    fecha_desde: desde,
    fecha_hasta: hasta,
    notas: texto(fd, "notas"),
  };

  if (!actual.reserva_id) {
    const deptoId = texto(fd, "depto_id");
    if (!deptoId) return { error: "Elegí el departamento." };
    cambios.depto_id = deptoId;
  }

  const { error } = await supabase
    .from("equipamiento_bebe")
    .update(cambios)
    .eq("id", id);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/reporte");
  revalidatePath("/dia");
  return { ok: "Guardado." };
}

/** Pedido → entregado → retirado. */
export async function cambiarEstadoEquipamiento(
  id: string,
  estado: EstadoEquipamiento,
) {
  const supabase = await conPermiso();
  if (!supabase) return;

  await supabase.from("equipamiento_bebe").update({ estado }).eq("id", id);
  revalidatePath("/reporte");
  revalidatePath("/dia");
}

export async function archivarEquipamiento(id: string) {
  const supabase = await conPermiso();
  if (!supabase) return;

  await supabase.from("equipamiento_bebe").update({ activo: false }).eq("id", id);
  revalidatePath("/reporte");
  revalidatePath("/dia");
}

export type ReservaParaEquipamiento = {
  id: string;
  codigo_reserva: string;
  huesped_nombre: string | null;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  depto: string | null;
};

/** Busca la reserva a la que colgarle la cuna, por código o por huésped. */
export async function buscarReservasParaEquipamiento(
  q: string,
): Promise<ReservaParaEquipamiento[]> {
  const supabase = await conPermiso();
  if (!supabase) return [];

  const termino = q.trim();
  if (termino.length < 2) return [];
  const patron = `%${termino}%`;

  const { data } = await supabase
    .from("reservas")
    .select(
      `id, codigo_reserva, huesped_nombre, fecha_checkin, fecha_checkout,
       depto:departamentos(codigo)`,
    )
    .or(`codigo_reserva.ilike.${patron},huesped_nombre.ilike.${patron}`)
    .eq("descartada", false)
    .eq("cancelada", false)
    .order("fecha_checkin", { ascending: false })
    .limit(8);

  return (data ?? []).map((r) => ({
    id: r.id,
    codigo_reserva: r.codigo_reserva,
    huesped_nombre: r.huesped_nombre,
    fecha_checkin: r.fecha_checkin,
    fecha_checkout: r.fecha_checkout,
    depto: r.depto?.codigo ?? null,
  }));
}
