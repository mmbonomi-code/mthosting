"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { congelarMonto, type Tarifa } from "@/lib/limpiezas/tarifas";
import type { Database } from "@/lib/database.types";

type TipoLimpieza = Database["public"]["Enums"]["limpieza_tipo"];

export type EstadoFormulario = { error: string } | null;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

/**
 * Asigna un responsable y CONGELA el monto (spec §3.2): se resuelve la
 * tarifa vigente a la fecha de la limpieza, se calcula el pago doble
 * (domingo o feriado) y el resultado no se recalcula nunca más.
 */
export async function asignarResponsable(
  limpiezaId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const personaId = texto(fd, "asignado_a");
  const supabase = await crearClienteServidor();

  // Quitar el responsable: vuelve a pendiente y se suelta el monto.
  if (!personaId) {
    const { error } = await supabase
      .from("limpiezas")
      .update({
        asignado_a: null,
        estado: "pendiente",
        monto_pactado: null,
        moneda: null,
        tarifa_id: null,
      })
      .eq("id", limpiezaId);
    if (error) return { error: "No se pudo quitar el responsable." };
    revalidatePath(`/limpiezas/${limpiezaId}`);
    revalidatePath("/limpiezas");
    return null;
  }

  const { data: limpieza } = await supabase
    .from("limpiezas")
    .select("id, fecha, depto_id, monto_pactado, depto:departamentos(ambientes)")
    .eq("id", limpiezaId)
    .maybeSingle();
  if (!limpieza) return { error: "No se encontró la limpieza." };

  const [{ data: tarifas }, { data: feriados }] = await Promise.all([
    supabase
      .from("tarifas")
      .select("id, ambientes, depto_id, monto, moneda, vigente_desde, vigente_hasta")
      .lte("vigente_desde", limpieza.fecha),
    supabase.from("feriados").select("fecha"),
  ]);

  const congelado = congelarMonto(
    (tarifas ?? []) as Tarifa[],
    new Set((feriados ?? []).map((f) => f.fecha)),
    {
      deptoId: limpieza.depto_id,
      ambientes: limpieza.depto?.ambientes ?? null,
      fecha: limpieza.fecha,
    },
  );

  const { error } = await supabase
    .from("limpiezas")
    .update({
      asignado_a: personaId,
      estado: "asignada",
      // El monto ya congelado no se pisa: el snapshot es para siempre.
      ...(limpieza.monto_pactado === null
        ? {
            monto_pactado: congelado.monto_pactado,
            moneda: congelado.moneda,
            tarifa_id: congelado.tarifa_id,
          }
        : {}),
      pago_doble: congelado.pago_doble,
    })
    .eq("id", limpiezaId);
  if (error) return { error: `No se pudo asignar: ${error.message}` };

  revalidatePath(`/limpiezas/${limpiezaId}`);
  revalidatePath("/limpiezas");
  return null;
}

/** Edita los datos operativos de la limpieza: tipo, fecha, hora y notas. */
export async function editarLimpieza(
  limpiezaId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const fecha = texto(fd, "fecha");
  const tipo = texto(fd, "tipo") as TipoLimpieza | null;
  if (!fecha || !tipo) return { error: "La fecha y el tipo son obligatorios." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("limpiezas")
    .update({
      fecha,
      tipo,
      hora_checkout: texto(fd, "hora_checkout"),
      notas: texto(fd, "notas"),
    })
    .eq("id", limpiezaId);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath(`/limpiezas/${limpiezaId}`);
  revalidatePath("/limpiezas");
  return null;
}

/** Las limpiezas no se borran nunca: pasan a cancelada. */
export async function cancelarLimpieza(limpiezaId: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("limpiezas").update({ estado: "cancelada" }).eq("id", limpiezaId);
  revalidatePath("/limpiezas");
  redirect("/limpiezas");
}

export async function reactivarLimpieza(limpiezaId: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("limpiezas").update({ estado: "pendiente" }).eq("id", limpiezaId);
  revalidatePath(`/limpiezas/${limpiezaId}`);
  revalidatePath("/limpiezas");
}

/**
 * Alta manual de limpieza (spec §3.2). Sirve para lo que el importador no
 * genera: cambios de blancos, limpiezas con huéspedes adentro, inicial,
 * desmantelar o una visita del propietario.
 */
export async function crearLimpieza(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const deptoId = texto(fd, "depto_id");
  const fecha = texto(fd, "fecha");
  const tipo = (texto(fd, "tipo") ?? "normal") as TipoLimpieza;

  if (!deptoId || !fecha) {
    return { error: "Elegí el departamento y la fecha." };
  }

  const supabase = await crearClienteServidor();

  // Si ese día hay un huésped adentro, la limpieza queda vinculada a su
  // reserva con rol "durante": es una limpieza de estadía en curso.
  const { data: enCurso } = await supabase
    .from("reservas")
    .select("id")
    .eq("depto_id", deptoId)
    .eq("cancelada", false)
    .eq("descartada", false)
    .lte("fecha_checkin", fecha)
    .gt("fecha_checkout", fecha)
    .limit(1)
    .maybeSingle();
  const reservaId = enCurso?.id ?? null;

  const { data, error } = await supabase
    .from("limpiezas")
    .insert({
      depto_id: deptoId,
      fecha,
      tipo,
      // "durante" deja claro que el huésped sigue adentro.
      reserva_id: reservaId,
      rol_reserva: reservaId ? "durante" : null,
      estado: "pendiente",
      hora_checkout: texto(fd, "hora_checkout"),
      notas: texto(fd, "notas"),
    })
    .select("id")
    .single();

  if (error) return { error: `No se pudo crear la limpieza: ${error.message}` };

  revalidatePath("/limpiezas");
  redirect(`/limpiezas/${data.id}`);
}
