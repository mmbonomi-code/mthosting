"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { decidirLateCheckout, type EstadoLimpieza } from "@/lib/eventos/reglas";

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

/** Marca los pendientes de la llegada: registro, aviso a seguridad, sobre. */
export async function marcarItem(
  reservaId: string,
  campo: "registro_hecho" | "aviso_seguridad_hecho" | "sobre_ok",
  valor: boolean,
) {
  const supabase = await crearClienteServidor();
  // Las tres columnas son booleanas; el campo llega acotado por el tipo.
  const cambio =
    campo === "registro_hecho"
      ? { registro_hecho: valor }
      : campo === "aviso_seguridad_hecho"
        ? { aviso_seguridad_hecho: valor }
        : { sobre_ok: valor };

  await supabase.from("reservas").update(cambio).eq("id", reservaId);
  revalidatePath("/dia");
}

/** Confirmación manual de que el equipo dejó la llave o el sobre. */
export async function marcarAccesoDejado(eventoId: string, valor: boolean) {
  const supabase = await crearClienteServidor();
  await supabase.from("eventos_estadia").update({ acceso_dejado: valor }).eq("id", eventoId);
  revalidatePath("/dia");
  revalidatePath(`/dia/${eventoId}`);
}


/**
 * Late check-out (spec §2.9): ese día el departamento no se puede limpiar.
 * Sin nadie entrando, la limpieza se mueve sola al día siguiente. Con
 * alguien entrando, el sistema no decide: avisa y lo resuelve una persona.
 */
export async function alternarLateCheckout(eventoId: string, valor: boolean) {
  const supabase = await crearClienteServidor();

  const { data: evento } = await supabase
    .from("eventos_estadia")
    .select("id, tipo, reserva:reservas(id, depto_id, fecha_checkout)")
    .eq("id", eventoId)
    .maybeSingle();
  if (!evento || evento.tipo !== "checkout" || !evento.reserva) return;

  await supabase
    .from("eventos_estadia")
    .update({ late_checkout: valor })
    .eq("id", eventoId);

  // Solo al marcarlo se evalúa mover la limpieza; al desmarcarlo no se
  // vuelve atrás sola: ya puede haber sido reprogramada a mano.
  if (!valor) {
    revalidatePath(`/dia/${eventoId}`);
    return;
  }

  const fechaCheckout = evento.reserva.fecha_checkout;
  const deptoId = evento.reserva.depto_id;
  if (!fechaCheckout || !deptoId) return;

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
    await supabase
      .from("limpiezas")
      .update({ fecha: decision.nuevaFecha })
      .eq("id", limpieza.id);
  }

  revalidatePath("/dia");
  revalidatePath(`/dia/${eventoId}`);
  revalidatePath("/limpiezas");
}
