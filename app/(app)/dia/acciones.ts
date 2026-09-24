"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { decidirLateCheckout, type EstadoLimpieza } from "@/lib/eventos/reglas";
import { ventanaDesde } from "@/lib/limpiezas/ventana-db";

export type EstadoFormulario = { error: string } | { aviso: string } | null;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

/**
 * Coordina un check-in o check-out: la fecha y hora acordadas con el huésped
 * y quién o qué le da acceso.
 *
 * Las fechas coordinadas NO tocan la reserva ni mueven la limpieza
 * (spec §2.8.ter): son información de coordinación. La fecha de la reserva
 * solo la cambia Airbnb.
 */
export async function coordinarEvento(
  eventoId: string,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();

  const { data: evento } = await supabase
    .from("eventos_estadia")
    .select(
      "id, tipo, reserva:reservas(id, adultos, ninos, depto:departamentos(self_checkout))",
    )
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento) return { error: "No se encontró el evento." };

  // El selector unificado devuelve "punto:<id>" o "persona:<id>".
  const acceso = texto(fd, "acceso");
  const [clase, id] = acceso ? acceso.split(":") : [null, null];

  // Self check-out configurable por departamento (spec §2.11).
  if (clase === "punto" && id) {
    const { data: punto } = await supabase
      .from("puntos_acceso")
      .select("metodo")
      .eq("id", id)
      .maybeSingle();

    if (punto?.metodo === "self") {
      const self = evento.reserva?.depto?.self_checkout;
      const huespedes =
        (evento.reserva?.adultos ?? 0) + (evento.reserva?.ninos ?? 0);

      if (self === "no") {
        return {
          error:
            "Este departamento no permite self check-out: hay que asignar una persona o un punto de acceso físico.",
        };
      }
      if (self === "solo_multiples" && huespedes <= 1 && fd.get("confirmar_self") !== "on") {
        return {
          error:
            "Viene una sola persona y en este departamento el self solo sirve con 2 o más: si baja y deja las llaves adentro puede quedar trabada afuera. Tildá la confirmación para hacerlo igual.",
        };
      }
    }
  }

  const esCheckin = evento.tipo === "checkin";
  const puntoId = clase === "punto" ? id : null;
  const personaId = clase === "persona" ? id : null;

  const cambios = {
    fecha_coordinada: texto(fd, "fecha_coordinada"),
    hora_coordinada: texto(fd, "hora_coordinada"),
    observaciones: texto(fd, "observaciones"),
    // El check-in usa punto_acceso/responsable; el check-out, los de devolución.
    ...(esCheckin
      ? { punto_acceso_id: puntoId, responsable_id: personaId }
      : { punto_devolucion_id: puntoId, responsable_devolucion_id: personaId }),
    estado: acceso || texto(fd, "hora_coordinada") ? "coordinado" : "pendiente",
  } as const;

  const { error } = await supabase
    .from("eventos_estadia")
    .update(cambios)
    .eq("id", eventoId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/dia");
  revalidatePath(`/dia/${eventoId}`);
  return null;
}

/**
 * Resultado de una casilla: si no se pudo guardar, la pantalla la vuelve
 * atrás y lo dice. Antes el tilde quedaba marcado aunque no se guardara.
 */
export type ResultadoCasilla = { error: string } | null;

/** Marca los pendientes de la llegada: registro, aviso a seguridad, sobre. */
export async function marcarItem(
  reservaId: string,
  campo: "registro_hecho" | "aviso_seguridad_hecho" | "sobre_ok",
  valor: boolean,
): Promise<ResultadoCasilla> {
  const supabase = await crearClienteServidor();
  // Las tres columnas son booleanas; el campo llega acotado por el tipo.
  const cambio =
    campo === "registro_hecho"
      ? { registro_hecho: valor }
      : campo === "aviso_seguridad_hecho"
        ? { aviso_seguridad_hecho: valor }
        : { sobre_ok: valor };

  const { error } = await supabase.from("reservas").update(cambio).eq("id", reservaId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  // La ficha también: ahí se ve el "Falta:" que esta casilla resuelve.
  revalidatePath("/dia", "layout");
  return null;
}

/** Confirmación manual de que el equipo dejó la llave o el sobre. */
export async function marcarAccesoDejado(
  eventoId: string,
  valor: boolean,
): Promise<ResultadoCasilla> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("eventos_estadia")
    .update({ acceso_dejado: valor })
    .eq("id", eventoId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };
  revalidatePath("/dia");
  revalidatePath(`/dia/${eventoId}`);
  return null;
}


/**
 * Late check-out (spec §2.9): ese día el departamento no se puede limpiar.
 * Sin nadie entrando, la limpieza se mueve sola al día siguiente. Con
 * alguien entrando, el sistema no decide: avisa y lo resuelve una persona.
 */
export async function alternarLateCheckout(
  eventoId: string,
  valor: boolean,
): Promise<ResultadoCasilla> {
  const supabase = await crearClienteServidor();

  const { data: evento } = await supabase
    .from("eventos_estadia")
    .select("id, tipo, reserva:reservas(id, depto_id, fecha_checkout)")
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento || evento.tipo !== "checkout" || !evento.reserva) {
    return { error: "No se encontró la salida." };
  }

  const { error } = await supabase
    .from("eventos_estadia")
    .update({ late_checkout: valor })
    .eq("id", eventoId);
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  const refrescar = () => {
    revalidatePath("/dia");
    revalidatePath(`/dia/${eventoId}`);
    revalidatePath("/limpiezas");
  };

  // Solo al marcarlo se evalúa mover la limpieza; al desmarcarlo no se
  // vuelve atrás sola: ya puede haber sido reprogramada a mano. La lista
  // del día sí se refresca, si no seguía mostrando "Late".
  if (!valor) {
    refrescar();
    return null;
  }

  const fechaCheckout = evento.reserva.fecha_checkout;
  const deptoId = evento.reserva.depto_id;
  if (!fechaCheckout || !deptoId) {
    refrescar();
    return null;
  }

  const [{ count: entradas }, { data: limpieza }] = await Promise.all([
    supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("depto_id", deptoId)
      .eq("cancelada", false)
      .eq("descartada", false)
      .eq("fecha_checkin", fechaCheckout),
    supabase
      .from("limpiezas")
      .select("id, fecha, estado")
      .eq("reserva_id", evento.reserva.id)
      .eq("rol_reserva", "salida")
      .maybeSingle(),
  ]);

  const decision = decidirLateCheckout({
    fechaCheckout,
    hayCheckinEseDia: (entradas ?? 0) > 0,
    limpieza: limpieza
      ? { id: limpieza.id, fecha: limpieza.fecha, estado: limpieza.estado as EstadoLimpieza }
      : null,
  });

  if (decision.accion === "mover" && limpieza) {
    // Al día siguiente puede entrar alguien: la marca de urgente se rehace.
    const ventana = await ventanaDesde(
      supabase,
      deptoId,
      decision.nuevaFecha,
      evento.reserva.id,
    );
    await supabase
      .from("limpiezas")
      // fecha_manual: true, si no la próxima vez que se actualicen reservas
      // el planificador ve que esta fecha "no coincide" con el checkout de
      // la reserva y la devuelve a su día original, deshaciendo el late
      // checkout sin que nadie lo haya tocado. Pasó de verdad con HMA58TESFD
      // de JUNCAL 2 (20/08/2026): se movió al 22 por late checkout a las
      // 14:07 y una actualización de reservas la devolvió al 21 a las 17:12,
      // el mismo día.
      .update({ fecha: decision.nuevaFecha, fecha_manual: true, ...ventana })
      .eq("id", limpieza.id);
  }

  refrescar();
  return null;
}
