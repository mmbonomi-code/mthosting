"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { congelarMonto, type Tarifa } from "@/lib/limpiezas/tarifas";
import {
  estadoAlQuitarResponsable,
  type EstadoLimpieza,
} from "@/lib/limpiezas/asignar";
import type { Database } from "@/lib/database.types";

type TipoLimpieza = Database["public"]["Enums"]["limpieza_tipo"];

export type EstadoFormulario = { error: string } | null;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

type LimpiezaParaMonto = {
  fecha: string;
  tipo: string;
  depto_id: string;
  depto: { ambientes: string | null } | null;
};

/** Resuelve la tarifa vigente a la fecha y aplica las reglas de pago. */
async function calcularMonto(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  limpieza: LimpiezaParaMonto,
) {
  const [{ data: tarifas }, { data: feriados }] = await Promise.all([
    supabase
      .from("tarifas")
      .select("id, ambientes, depto_id, monto, moneda, vigente_desde, vigente_hasta")
      .lte("vigente_desde", limpieza.fecha),
    supabase.from("feriados").select("fecha"),
  ]);

  return congelarMonto(
    (tarifas ?? []) as Tarifa[],
    new Set((feriados ?? []).map((f) => f.fecha)),
    {
      deptoId: limpieza.depto_id,
      ambientes: limpieza.depto?.ambientes ?? null,
      fecha: limpieza.fecha,
      tipo: limpieza.tipo,
    },
  );
}

/**
 * Recalcula el monto de una limpieza ya asignada. Es una acción EXPLÍCITA
 * de una persona: el sistema nunca recalcula solo (spec §3.2). Sirve cuando
 * cambió el tipo o la fecha después de asignarla, o cuando se cargaron las
 * tarifas más tarde.
 */
export async function recalcularMonto(limpiezaId: string) {
  const supabase = await crearClienteServidor();

  const { data: limpieza } = await supabase
    .from("limpiezas")
    .select("id, fecha, tipo, depto_id, depto:departamentos(ambientes)")
    .eq("id", limpiezaId)
    .maybeSingle();
  if (!limpieza) return;

  const congelado = await calcularMonto(supabase, limpieza);

  await supabase
    .from("limpiezas")
    .update({
      monto_pactado: congelado.monto_pactado,
      moneda: congelado.moneda,
      tarifa_id: congelado.tarifa_id,
      pago_doble: congelado.pago_doble,
    })
    .eq("id", limpiezaId);

  revalidatePath(`/limpiezas/${limpiezaId}`);
  revalidatePath("/limpiezas");
}

/**
 * Asigna un responsable y CONGELA el monto (spec §3.2): se resuelve la
 * tarifa vigente a la fecha de la limpieza, se aplican las reglas de pago
 * (doble por inicial, profunda, domingo o feriado; 50% en repasos) y el
 * resultado no se recalcula solo nunca más.
 */
/** El estado que le toca a la limpieza al soltarle la persona. */
async function estadoSinResponsable(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  limpiezaId: string,
): Promise<EstadoLimpieza | null> {
  const { data } = await supabase
    .from("limpiezas")
    .select("estado")
    .eq("id", limpiezaId)
    .maybeSingle();
  return data ? estadoAlQuitarResponsable(data.estado) : null;
}

export async function asignarResponsable(
  limpiezaId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const personaId = texto(fd, "asignado_a");
  const supabase = await crearClienteServidor();

  // Quitar el responsable: vuelve a pendiente y se suelta el monto. Una
  // limpieza cancelada sigue cancelada (ver estadoAlQuitarResponsable).
  if (!personaId) {
    const estado = await estadoSinResponsable(supabase, limpiezaId);
    if (estado === null) return { error: "No se encontró la limpieza." };

    const { error } = await supabase
      .from("limpiezas")
      .update({
        asignado_a: null,
        estado,
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
    .select("id, fecha, tipo, depto_id, monto_pactado, depto:departamentos(ambientes)")
    .eq("id", limpiezaId)
    .maybeSingle();
  if (!limpieza) return { error: "No se encontró la limpieza." };

  const congelado = await calcularMonto(supabase, limpieza);

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

/**
 * Asignación rápida desde el listado, sin entrar a la ficha. Congela el
 * monto igual que la asignación normal: es la misma decisión.
 */
export async function asignarRapido(limpiezaId: string, personaId: string | null) {
  const supabase = await crearClienteServidor();

  if (!personaId) {
    const estado = await estadoSinResponsable(supabase, limpiezaId);
    if (estado === null) return;

    await supabase
      .from("limpiezas")
      .update({
        asignado_a: null,
        estado,
        monto_pactado: null,
        moneda: null,
        tarifa_id: null,
      })
      .eq("id", limpiezaId);
    revalidatePath("/limpiezas");
    revalidatePath("/semana");
    return;
  }

  const { data: limpieza } = await supabase
    .from("limpiezas")
    .select("id, fecha, tipo, depto_id, monto_pactado, depto:departamentos(ambientes)")
    .eq("id", limpiezaId)
    .maybeSingle();
  if (!limpieza) return;

  const congelado = await calcularMonto(supabase, limpieza);

  await supabase
    .from("limpiezas")
    .update({
      asignado_a: personaId,
      estado: "asignada",
      // Un monto ya congelado no se pisa.
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

  revalidatePath("/limpiezas");
  revalidatePath("/semana");
  revalidatePath(`/limpiezas/${limpiezaId}`);
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

  // Mover una limpieza a un día que ya tiene otra deja las dos: mismo control
  // que en el alta.
  const { data: actual } = await supabase
    .from("limpiezas")
    .select(
      "depto_id, fecha, rol_reserva, reserva:reservas(fecha_checkin, fecha_checkout)",
    )
    .eq("id", limpiezaId)
    .maybeSingle();
  if (actual && actual.fecha !== fecha) {
    const { data: yaHay } = await supabase
      .from("limpiezas")
      .select("id")
      .eq("depto_id", actual.depto_id)
      .eq("fecha", fecha)
      .neq("estado", "cancelada")
      .neq("id", limpiezaId)
      .limit(1)
      .maybeSingle();
    if (yaHay) {
      return {
        error: "Ese departamento ya tiene una limpieza ese día. Elegí otra fecha.",
      };
    }
  }

  // Si la fecha que elige la persona NO es la que le tocaría por la reserva,
  // queda fijada: la importación no la vuelve a mover. Y si la devuelve a su
  // día natural, vuelve a seguir la reserva sola, sin tener que destildar
  // nada. Sin esto, la limpieza volvía a su lugar en cada importación.
  const natural =
    actual?.rol_reserva === "entrada"
      ? (actual.reserva as { fecha_checkin: string | null } | null)?.fecha_checkin
      : (actual?.reserva as { fecha_checkout: string | null } | null)?.fecha_checkout;

  const { error } = await supabase
    .from("limpiezas")
    // La hora de salida no se edita acá: sale de lo coordinado en el
    // check-out de la reserva.
    .update({
      fecha,
      tipo,
      notas: texto(fd, "notas"),
      // Una limpieza suelta, sin reserva, siempre lleva fecha puesta a mano.
      fecha_manual: natural == null ? true : fecha !== natural,
    })
    .eq("id", limpiezaId);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath(`/limpiezas/${limpiezaId}`);
  revalidatePath("/limpiezas");
  return null;
}

/**
 * Las limpiezas no se borran nunca: pasan a cancelada.
 *
 * Queda marcada como cancelada A MANO para que la importación no la reviva.
 * El planificador tiene una regla que devuelve a pendiente las limpiezas
 * canceladas —sirve para cuando una reserva descartada reaparece— y sin esta
 * marca no distinguía quién la había cancelado.
 */
export async function cancelarLimpieza(limpiezaId: string) {
  const supabase = await crearClienteServidor();
  await supabase
    .from("limpiezas")
    .update({ estado: "cancelada", cancelada_manual: true })
    .eq("id", limpiezaId);
  revalidatePath("/limpiezas");
  revalidatePath("/semana");
  redirect("/limpiezas");
}

/** Volver atrás la cancelación: deja de estar decidida a mano. */
export async function reactivarLimpieza(limpiezaId: string) {
  const supabase = await crearClienteServidor();
  await supabase
    .from("limpiezas")
    .update({ estado: "pendiente", cancelada_manual: false })
    .eq("id", limpiezaId);
  revalidatePath(`/limpiezas/${limpiezaId}`);
  revalidatePath("/limpiezas");
  revalidatePath("/semana");
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

  // Un departamento no puede tener dos limpiezas el mismo día (decisión del
  // dueño, 13/08/2026). Se corta acá, antes de crearla: hasta ahora la
  // pantalla dejaba cargar una encima de la que ya había generado el sistema,
  // y quedaban las dos sin que nadie se enterara.
  const { data: yaHay } = await supabase
    .from("limpiezas")
    .select("id, tipo")
    .eq("depto_id", deptoId)
    .eq("fecha", fecha)
    .neq("estado", "cancelada")
    .limit(1)
    .maybeSingle();
  if (yaHay) {
    return {
      error:
        "Ese departamento ya tiene una limpieza ese día. Si hay que cambiarle algo, editá la que está en vez de cargar otra.",
    };
  }

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
