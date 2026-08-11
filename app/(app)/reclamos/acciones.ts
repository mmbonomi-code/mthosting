"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeGestionarReclamos } from "@/lib/reclamos/permisos";
import { fotosDeLimpieza } from "@/lib/reclamos/fotos-limpieza";
import { camposAlCambiar, faltaParaPresentar, puedeIr } from "@/lib/reclamos/estados";
import type { EstadoReclamo } from "@/lib/reclamos/plazos";
import type { Database } from "@/lib/database.types";
import {
  BUCKET,
  type EstadoFormulario,
  type ReservaEncontrada,
} from "@/lib/reclamos/storage";

type Categoria = Database["public"]["Enums"]["reclamo_categoria"];

/** Tipos que sirven como evidencia: fotos y presupuestos en PDF. */
const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"];
const TAMANIO_MAXIMO = 15 * 1024 * 1024;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function numero(fd: FormData, campo: string): number | null {
  const crudo = texto(fd, campo);
  if (crudo === null) return null;
  // Se acepta la coma decimal, que es como se escribe acá.
  const valor = Number(crudo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

/** Todas las acciones empiezan igual: sesión con permiso o nada. */
async function conPermiso() {
  const supabase = await crearClienteServidor();
  if (!(await puedeGestionarReclamos(supabase))) return null;
  return supabase;
}

/**
 * Crea el reclamo de una reserva y le engancha las fotos que la limpieza
 * cargó en ese check-out. Si esa reserva ya tenía uno, lleva al existente en
 * vez de crear otro: es un reclamo por reserva.
 */
export async function crearReclamo(reservaId: string) {
  const supabase = await conPermiso();
  if (!supabase) return;

  const { data: existente } = await supabase
    .from("reclamos")
    .select("id")
    .eq("reserva_id", reservaId)
    .maybeSingle();

  if (existente) redirect(`/reclamos/${existente.id}`);

  const { data: creado, error } = await supabase
    .from("reclamos")
    .insert({ reserva_id: reservaId })
    .select("id")
    .single();

  if (error || !creado) redirect(`/reclamos?error=alta`);

  // Las fotos del check-out vienen solas. Hoy la lista es vacía porque el
  // módulo de limpieza no existe todavía (lib/reclamos/fotos-limpieza.ts).
  const fotos = await fotosDeLimpieza(reservaId);
  if (fotos.length > 0) {
    await supabase.from("reclamo_fotos").insert(
      fotos.map((f, i) => ({
        reclamo_id: creado.id,
        storage_path: f.storage_path,
        tomada_at: f.tomada_at,
        origen: "limpieza" as const,
        orden: i,
      })),
    );
  }

  revalidatePath("/reclamos");
  redirect(`/reclamos/${creado.id}`);
}

/**
 * El detalle del reclamo. Se guarda solo con cada cambio, como la
 * coordinación del día: nadie se acuerda de apretar guardar.
 */
export async function guardarDetalle(
  id: string,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "No tenés permiso para editar reclamos." };

  const monto = numero(fd, "monto_reclamado");
  if (monto !== null && monto <= 0) {
    return { error: "El monto reclamado tiene que ser mayor a cero." };
  }

  const { error } = await supabase
    .from("reclamos")
    .update({
      motivo: texto(fd, "motivo"),
      monto_reclamado: monto,
      categoria: (texto(fd, "categoria") ?? "otro") as Categoria,
      nota_interna: texto(fd, "nota_interna"),
      url_airbnb: texto(fd, "url_airbnb"),
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/reclamos/${id}`);
  revalidatePath("/reclamos");
  return null;
}

/**
 * Mueve el reclamo de estado. Las transiciones válidas y lo que hay que
 * grabar en cada una viven en lib/reclamos/estados.ts, no acá.
 */
export async function cambiarEstado(
  id: string,
  destino: EstadoReclamo,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "No tenés permiso para editar reclamos." };

  const { data: reclamo } = await supabase
    .from("reclamos")
    .select("id, estado, motivo, monto_reclamado")
    .eq("id", id)
    .maybeSingle();
  if (!reclamo) return { error: "No se encontró el reclamo." };

  const actual = reclamo.estado as EstadoReclamo;
  if (!puedeIr(actual, destino)) {
    return { error: `Un reclamo ${actual} no puede pasar a ${destino}.` };
  }

  // Presentar algo sin motivo ni monto no tiene sentido: es lo que se copia
  // al Centro de resoluciones.
  if (destino === "por_presentar" || destino === "presentado") {
    const faltan = faltaParaPresentar({
      motivo: reclamo.motivo,
      monto_reclamado: reclamo.monto_reclamado,
    });
    if (faltan.length > 0) {
      return { error: `Antes de presentarlo falta ${faltan.join(" y ")}.` };
    }
  }

  const montoCobrado = destino === "cobrado" ? numero(fd, "monto_cobrado") : null;
  if (destino === "cobrado" && (montoCobrado === null || montoCobrado < 0)) {
    return { error: "Poné cuánto se cobró. Si no se cobró nada, marcalo como rechazado." };
  }

  const cambios = camposAlCambiar(destino, new Date().toISOString(), montoCobrado ?? undefined);

  // El link del caso se guarda si lo pegaron en el mismo paso; es opcional.
  const url = texto(fd, "url_airbnb");
  const { error } = await supabase
    .from("reclamos")
    .update(url ? { ...cambios, url_airbnb: url } : cambios)
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/reclamos/${id}`);
  revalidatePath("/reclamos");
  return null;
}

/** Solo administración puede reabrir algo ya cerrado. */
export async function reabrirReclamo(id: string): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: yo } = await supabase
    .from("personas")
    .select("rol")
    .eq("profile_id", user!.id)
    .maybeSingle();
  if (yo?.rol !== "admin") {
    return { error: "Solo administración puede reabrir un reclamo cerrado." };
  }

  const { error } = await supabase
    .from("reclamos")
    .update({ estado: "borrador", resuelto_at: null, monto_cobrado: null })
    .eq("id", id);
  if (error) return { error: `No se pudo reabrir: ${error.message}` };

  revalidatePath(`/reclamos/${id}`);
  revalidatePath("/reclamos");
  return null;
}

/**
 * Sube evidencia al bucket privado. Se carga desde la computadora, de a
 * varios archivos: fotos y presupuestos en PDF.
 */
export async function subirEvidencia(
  id: string,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await conPermiso();
  if (!supabase) return { error: "No tenés permiso para editar reclamos." };

  const archivos = fd.getAll("archivos").filter((a): a is File => a instanceof File);
  if (archivos.length === 0) return { error: "No elegiste ningún archivo." };

  const { data: ultima } = await supabase
    .from("reclamo_fotos")
    .select("orden")
    .eq("reclamo_id", id)
    .order("orden", { ascending: false })
    .limit(1)
    .maybeSingle();
  let orden = (ultima?.orden ?? -1) + 1;

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

    const { error: errorSubida } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, archivo, { contentType: archivo.type, upsert: false });

    if (errorSubida) {
      rechazados.push(`${archivo.name} (${errorSubida.message})`);
      continue;
    }

    await supabase.from("reclamo_fotos").insert({
      reclamo_id: id,
      storage_path: ruta,
      origen: "manual",
      orden: orden++,
    });
  }

  revalidatePath(`/reclamos/${id}`);

  if (rechazados.length > 0) {
    return { error: `No se pudieron subir: ${rechazados.join(", ")}.` };
  }
  return { ok: "Evidencia agregada." };
}

/**
 * Saca una foto de la evidencia. Es una baja lógica: deja de mostrarse pero
 * el archivo sigue guardado (CLAUDE.md, regla 3). Es la prueba de un reclamo
 * de plata; borrarla de verdad no tiene vuelta atrás.
 */
export async function ocultarEvidencia(reclamoId: string, fotoId: string) {
  const supabase = await conPermiso();
  if (!supabase) return;

  await supabase.from("reclamo_fotos").update({ activo: false }).eq("id", fotoId);
  revalidatePath(`/reclamos/${reclamoId}`);
}

/** Busca la reserva a la que cargarle el reclamo, por código o por huésped. */
export async function buscarReservas(q: string): Promise<ReservaEncontrada[]> {
  const supabase = await conPermiso();
  if (!supabase) return [];

  const termino = q.trim();
  if (termino.length < 2) return [];
  const patron = `%${termino}%`;

  const { data } = await supabase
    .from("reservas")
    .select(
      `id, codigo_reserva, huesped_nombre, fecha_checkin, fecha_checkout,
       depto:departamentos(codigo),
       reclamo:reclamos(id)`,
    )
    .or(`codigo_reserva.ilike.${patron},huesped_nombre.ilike.${patron}`)
    .eq("descartada", false)
    .order("fecha_checkout", { ascending: false })
    .limit(8);

  return (data ?? []).map((r) => ({
    id: r.id,
    codigo_reserva: r.codigo_reserva,
    huesped_nombre: r.huesped_nombre,
    fecha_checkin: r.fecha_checkin,
    fecha_checkout: r.fecha_checkout,
    depto: r.depto?.codigo ?? null,
    // Es uno a uno: la restricción única sobre reserva_id hace que venga
    // como objeto y no como lista.
    reclamo_id: r.reclamo?.id ?? null,
  }));
}
