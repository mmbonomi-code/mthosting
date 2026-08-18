"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { BUCKET_COMPROBANTES, type EstadoFormulario } from "@/lib/caja/tipos";
import { recalcularCobertura } from "@/lib/caja/recalcular";
import { abrirCaja, cerrarCaja, codigoEsCorrecto } from "@/lib/caja/codigo";
import type { Database } from "@/lib/database.types";

type TipoCaja = Database["public"]["Enums"]["caja_tipo"];

const TIPOS_ACEPTADOS = [
  "image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf",
];
const TAMANIO_MAXIMO = 15 * 1024 * 1024;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

/** Acepta `1.716.000`, `1716000` y `1716000,50`. */
function monto(fd: FormData, campo: string): number | null {
  const crudo = texto(fd, campo);
  if (crudo === null) return null;
  const normalizado = crudo.includes(",")
    ? crudo.replace(/\./g, "").replace(",", ".")
    : crudo.replace(/\./g, "");
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

async function conPermiso() {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCaja(supabase))) return null;
  return supabase;
}

/** La cotización que corresponde a una fecha, si está cargada. */
async function cotizacionDe(
  supabase: NonNullable<Awaited<ReturnType<typeof conPermiso>>>,
  fecha: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("cotizaciones")
    .select("tc")
    .eq("fecha", fecha)
    .maybeSingle();
  return data?.tc ?? null;
}

function validar(datos: {
  fecha: string | null;
  monto: number | null;
  categoria_id: string | null;
  depto_id: string | null;
  reembolsable: boolean;
}): string | null {
  if (!datos.fecha) return "Poné la fecha.";
  if (datos.monto === null || datos.monto <= 0) {
    return "El monto tiene que ser mayor a cero. El signo lo da si es ingreso o egreso.";
  }
  if (!datos.categoria_id) return "Elegí la categoría.";
  if (datos.reembolsable && !datos.depto_id) {
    return "Para marcarlo reembolsable hay que decir de qué departamento es.";
  }
  return null;
}

/**
 * Abre la caja con el código. Es una cortina sobre la pantalla, no un
 * permiso: quien llega hasta acá ya es manager o administración.
 */
export async function desbloquearCaja(fd: FormData): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "La caja es de manager y administración." };

  const valor = String(fd.get("codigo") ?? "");
  if (!codigoEsCorrecto(valor)) return { error: "El código no es correcto." };

  await abrirCaja();
  revalidatePath("/caja");
  return null;
}

/** Vuelve a pedir el código, sin cerrar la sesión del sistema. */
export async function bloquearCaja() {
  await cerrarCaja();
  revalidatePath("/caja");
  redirect("/caja");
}

/**
 * Un ingreso de una categoría de cambio se carga en dólares y tipo de
 * cambio, y los pesos salen de multiplicar. Es como se opera: a Maguie le
 * avisan "cambié tantos dólares a tanto".
 */
async function datosDelCambio(
  supabase: NonNullable<Awaited<ReturnType<typeof conPermiso>>>,
  categoriaId: string | null,
  tipo: TipoCaja,
  fd: FormData,
): Promise<
  { ok: true; usd: number | null; tc: number | null; pesos: number | null } | { ok: false; error: string }
> {
  if (tipo !== "ingreso" || !categoriaId) {
    return { ok: true, usd: null, tc: null, pesos: null };
  }

  const { data: categoria } = await supabase
    .from("categorias_movimiento")
    .select("es_cambio")
    .eq("id", categoriaId)
    .maybeSingle();

  if (!categoria?.es_cambio) return { ok: true, usd: null, tc: null, pesos: null };

  const usd = monto(fd, "usd_cambiado");
  const tc = monto(fd, "tc_cambio");

  if (usd === null || tc === null) {
    return {
      ok: false,
      error: "Poné cuántos dólares se cambiaron y a qué tipo de cambio.",
    };
  }
  if (usd <= 0 || tc <= 0) {
    return { ok: false, error: "Los dólares y el tipo de cambio tienen que ser mayores a cero." };
  }

  return { ok: true, usd, tc, pesos: Math.round(usd * tc * 100) / 100 };
}

export async function crearMovimiento(fd: FormData): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "La caja es de manager y administración." };

  const fecha = texto(fd, "fecha");
  const categoriaId = texto(fd, "categoria_id");
  const deptoId = texto(fd, "depto_id");
  const reembolsable = fd.get("reembolsable") === "on";
  const tipo = (texto(fd, "tipo") ?? "egreso") as TipoCaja;

  const cambio = await datosDelCambio(supabase, categoriaId, tipo, fd);
  if (!cambio.ok) return { error: cambio.error };

  // En un cambio los pesos no se escriben: son el producto.
  const importe = cambio.pesos ?? monto(fd, "monto");

  const error = validar({ fecha, monto: importe, categoria_id: categoriaId, depto_id: deptoId, reembolsable });
  if (error) return { error };

  // La cotización del día se congela junto al movimiento. Si todavía no está
  // cargada, el movimiento entra igual y queda sin valor en dólares hasta que
  // se cargue: no se inventa un número.
  const tc = await cotizacionDe(supabase, fecha!);

  const { error: errorAlta } = await supabase.from("movimientos_caja").insert({
    fecha: fecha!,
    tipo,
    monto: importe!,
    moneda: "ARS",
    tc,
    fecha_tc: tc === null ? null : fecha,
    categoria_id: categoriaId,
    depto_id: deptoId,
    descripcion: texto(fd, "descripcion"),
    reembolsable: reembolsable && deptoId !== null,
    usd_cambiado: cambio.usd,
    tc_cambio: cambio.tc,
  });

  if (errorAlta) return { error: `No se pudo guardar: ${errorAlta.message}` };

  await recalcularCobertura(supabase);

  revalidatePath("/caja");
  // Sin redirect a propósito: se carga un movimiento detrás de otro, y volver
  // a la ficha recién creada obligaba a ir hasta "Caja" y tocar "+ Movimiento"
  // de nuevo por cada uno. El formulario se limpia solo (FormularioMovimiento)
  // apenas ve este "ok".
  return { ok: "Movimiento guardado. Ya podés cargar el siguiente." };
}

export async function editarMovimiento(
  id: string,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "La caja es de manager y administración." };

  const fecha = texto(fd, "fecha");
  const categoriaId = texto(fd, "categoria_id");
  const deptoId = texto(fd, "depto_id");
  const reembolsable = fd.get("reembolsable") === "on";
  const tipo = (texto(fd, "tipo") ?? "egreso") as TipoCaja;

  const cambio = await datosDelCambio(supabase, categoriaId, tipo, fd);
  if (!cambio.ok) return { error: cambio.error };

  const importe = cambio.pesos ?? monto(fd, "monto");

  const error = validar({ fecha, monto: importe, categoria_id: categoriaId, depto_id: deptoId, reembolsable });
  if (error) return { error };

  const { data: actual } = await supabase
    .from("movimientos_caja")
    .select("fecha, tc")
    .eq("id", id)
    .maybeSingle();

  // Si se movió la fecha, la cotización congelada deja de corresponder.
  const tc = actual?.fecha === fecha ? actual.tc : await cotizacionDe(supabase, fecha!);

  const { error: errorEdicion } = await supabase
    .from("movimientos_caja")
    .update({
      fecha: fecha!,
      tipo,
      monto: importe!,
      tc,
      fecha_tc: tc === null ? null : fecha,
      categoria_id: categoriaId,
      depto_id: deptoId,
      descripcion: texto(fd, "descripcion"),
      reembolsable: reembolsable && deptoId !== null,
      usd_cambiado: cambio.usd,
      tc_cambio: cambio.tc,
      // Si deja de ser reembolsable, el cobro no tiene sentido.
      ...(reembolsable && deptoId !== null
        ? {}
        : { fecha_cobro: null, forma_cobro: null, notas_cobro: null }),
    })
    .eq("id", id);

  if (errorEdicion) return { error: `No se pudo guardar: ${errorEdicion.message}` };

  await recalcularCobertura(supabase);

  revalidatePath("/caja");
  revalidatePath(`/caja/${id}`);
  return { ok: "Guardado." };
}

/**
 * Marca cobrados uno o varios reembolsables, con la misma fecha y forma de
 * pago. Se cobra por departamento, no de a un gasto: por eso van juntos.
 */
export async function marcarCobrados(fd: FormData): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "La caja es de manager y administración." };

  const ids = fd.getAll("ids").map(String).filter(Boolean);
  if (ids.length === 0) return { error: "No elegiste ningún movimiento." };

  const fecha = texto(fd, "fecha_cobro");
  if (!fecha) return { error: "Poné la fecha en la que se cobró." };

  const { error } = await supabase
    .from("movimientos_caja")
    .update({
      fecha_cobro: fecha,
      forma_cobro: texto(fd, "forma_cobro"),
      notas_cobro: texto(fd, "notas_cobro"),
    })
    .in("id", ids)
    .eq("reembolsable", true);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/caja");
  revalidatePath("/caja/por-cobrar");
  return { ok: `${ids.length} movimiento${ids.length === 1 ? "" : "s"} marcado${ids.length === 1 ? "" : "s"} como cobrado${ids.length === 1 ? "" : "s"}.` };
}

/** Vuelve un cobro a pendiente, si se marcó por error. */
export async function desmarcarCobro(id: string) {
  const supabase = await conPermiso();
  if (!supabase) return;

  await supabase
    .from("movimientos_caja")
    .update({ fecha_cobro: null, forma_cobro: null, notas_cobro: null })
    .eq("id", id);

  revalidatePath("/caja");
  revalidatePath("/caja/por-cobrar");
  revalidatePath(`/caja/${id}`);
}

/** Baja lógica: el movimiento sale del saldo pero no se borra. */
export async function anularMovimiento(id: string) {
  const supabase = await conPermiso();
  if (!supabase) return;

  await supabase.from("movimientos_caja").update({ activo: false }).eq("id", id);
  await recalcularCobertura(supabase);
  revalidatePath("/caja");
  redirect("/caja");
}

/**
 * Carga la cotización de un día y completa sola los movimientos de esa fecha
 * que la estaban esperando. Así se pueden cargar movimientos sin acordarse
 * del dólar y ponerlo después.
 */
export async function guardarCotizacion(fd: FormData): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "La caja es de manager y administración." };

  const fecha = texto(fd, "fecha");
  const tc = monto(fd, "tc");
  if (!fecha) return { error: "Poné la fecha." };
  if (tc === null || tc <= 0) return { error: "La cotización tiene que ser mayor a cero." };

  const { error } = await supabase
    .from("cotizaciones")
    .upsert({ fecha, tc }, { onConflict: "fecha" });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  const { count } = await supabase
    .from("movimientos_caja")
    .update({ tc, fecha_tc: fecha }, { count: "exact" })
    .eq("fecha", fecha)
    .is("tc", null);

  revalidatePath("/caja");
  revalidatePath("/caja/cotizaciones");
  return {
    ok:
      count && count > 0
        ? `Guardada. Se completaron ${count} movimiento${count === 1 ? "" : "s"} de ese día.`
        : "Guardada.",
  };
}

export async function crearCategoria(fd: FormData): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "La caja es de manager y administración." };

  const nombre = texto(fd, "nombre");
  if (!nombre) return { error: "Poné el nombre de la categoría." };

  const { error } = await supabase
    .from("categorias_movimiento")
    .insert({ nombre: nombre.toUpperCase() });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/caja/categorias");
  return { ok: "Categoría agregada." };
}

export async function alternarCategoria(id: string, activo: boolean) {
  const supabase = await conPermiso();
  if (!supabase) return;

  await supabase.from("categorias_movimiento").update({ activo }).eq("id", id);
  revalidatePath("/caja/categorias");
}

/** Comprobantes: factura, transferencia. Van al bucket privado. */
export async function subirComprobante(
  id: string,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "La caja es de manager y administración." };

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
      rechazados.push(`${archivo.name} (no es una imagen ni un PDF)`);
      continue;
    }

    const extension = archivo.name.split(".").pop()?.toLowerCase() ?? "bin";
    const ruta = `${id}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from(BUCKET_COMPROBANTES)
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
    if (error) {
      rechazados.push(`${archivo.name} (${error.message})`);
      continue;
    }

    await supabase
      .from("movimiento_comprobantes")
      .insert({ movimiento_id: id, storage_path: ruta });
  }

  revalidatePath(`/caja/${id}`);
  if (rechazados.length > 0) {
    return { error: `No se pudieron subir: ${rechazados.join(", ")}.` };
  }
  return { ok: "Comprobante agregado." };
}

export async function ocultarComprobante(movimientoId: string, comprobanteId: string) {
  const supabase = await conPermiso();
  if (!supabase) return;

  await supabase
    .from("movimiento_comprobantes")
    .update({ activo: false })
    .eq("id", comprobanteId);
  revalidatePath(`/caja/${movimientoId}`);
}
