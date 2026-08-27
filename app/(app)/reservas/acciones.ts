"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEditarReservas } from "@/lib/reservas/permisos";
import { esManagerOAdmin } from "@/lib/permisos";
import {
  calcularNoches,
  codigoDeReservaDirecta,
  validarReserva,
  type OrigenManual,
} from "@/lib/reservas/validar";
import { generarLimpiezas } from "@/lib/limpiezas/generar";
import {
  descartarReservaEnBase,
  recuperarReservaEnBase,
} from "@/lib/reservas/descartar";
import { hoyAR } from "@/lib/fechas";
import { corregirContactoAR } from "@/lib/telefono";
import type { EstadoFormulario } from "@/lib/reservas/tipos";

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function entero(fd: FormData, campo: string): number | null {
  const crudo = texto(fd, campo);
  if (crudo === null) return null;
  const valor = Number.parseInt(crudo, 10);
  return Number.isFinite(valor) ? valor : null;
}

function numero(fd: FormData, campo: string): number | null {
  const crudo = texto(fd, campo);
  if (crudo === null) return null;
  const valor = Number(crudo.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

/** Los campos que se cargan a mano, iguales en el alta y en la edición. */
function datosDelFormulario(fd: FormData) {
  return {
    depto_id: texto(fd, "depto_id"),
    huesped_nombre: texto(fd, "huesped_nombre"),
    // El 9 de los teléfonos argentinos se corrige acá también, no solo al
    // importar: si lo escriben a mano tiene que quedar igual de usable.
    huesped_contacto: corregirContactoAR(texto(fd, "huesped_contacto")),
    fecha_checkin: texto(fd, "fecha_checkin"),
    fecha_checkout: texto(fd, "fecha_checkout"),
    adultos: entero(fd, "adultos"),
    ninos: entero(fd, "ninos"),
    bebes: entero(fd, "bebes"),
    payout_monto: numero(fd, "payout_monto"),
  };
}

/** Las pantallas que muestran reservas, todas juntas. */
function revalidar(id: string) {
  revalidatePath("/dia");
  revalidatePath("/semana");
  revalidatePath("/limpiezas");
  revalidatePath("/bandeja");
  revalidatePath(`/reservas/${id}/editar`);
}

/** Las anomalías del planificador se muestran, no se tragan. */
function avisos(anomalias: string[]): string {
  return anomalias.length === 0 ? "" : ` ${anomalias.join(" ")}`;
}

/**
 * Alta manual de una reserva. Sirve para una reserva directa, fuera de
 * Airbnb, y para una de Airbnb que todavía no llegó en ninguna importación:
 * cargada con su código real, la próxima importación la reconoce y la
 * completa sola en vez de duplicarla.
 *
 * Los eventos de check-in/check-out y la limpieza los arma la misma
 * maquinaria que usa el importador, así que una reserva cargada a mano se
 * comporta igual que una importada.
 */
export async function crearReserva(fd: FormData): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  if (!(await puedeEditarReservas(supabase))) {
    return { error: "Solo coordinación, manager y administración pueden cargar reservas." };
  }

  const origen = (texto(fd, "tipo") ?? "directa") as OrigenManual;
  const datos = datosDelFormulario(fd);
  const codigoEscrito = (texto(fd, "codigo_reserva") ?? "").toUpperCase();

  const errores = validarReserva({
    origen,
    codigo_reserva: codigoEscrito,
    depto_id: datos.depto_id,
    fecha_checkin: datos.fecha_checkin,
    fecha_checkout: datos.fecha_checkout,
    huesped_nombre: datos.huesped_nombre,
    adultos: datos.adultos,
  });
  if (errores.length > 0) return { error: errores.join(" ") };

  const codigo =
    origen === "airbnb" ? codigoEscrito : codigoDeReservaDirecta(crypto.randomUUID());

  // Si ya existe esa reserva, no se crea otra: se abre la que hay.
  const { data: existente } = await supabase
    .from("reservas")
    .select("id")
    .eq("codigo_reserva", codigo)
    .maybeSingle();
  if (existente) {
    return {
      error: `Ya hay una reserva cargada con el código ${codigo}. Buscala y editala en vez de crear otra.`,
    };
  }

  const { data: creada, error } = await supabase
    .from("reservas")
    .insert({
      ...datos,
      codigo_reserva: codigo,
      canal: origen === "airbnb" ? "airbnb" : "directa",
      origen: "manual",
      // Se cargó a mano y está completa: no lleva la marca de "tentativa".
      datos_completos: true,
      noches: calcularNoches(datos.fecha_checkin, datos.fecha_checkout),
      payout_moneda: datos.payout_monto === null ? null : "USD",
    })
    .select("id, codigo_reserva")
    .single();

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // Los eventos y la limpieza salen de la misma función que usa el
  // importador: una reserva manual no es un caso aparte.
  try {
    await generarLimpiezas(supabase, [creada.codigo_reserva], hoyAR());
  } catch (e) {
    return {
      error: `La reserva se guardó pero no se pudieron generar los eventos: ${
        e instanceof Error ? e.message : "error desconocido"
      }`,
    };
  }

  revalidatePath("/dia");
  revalidatePath("/semana");
  redirect(`/reservas/${creada.id}/editar?creada=1`);
}

/**
 * Edición manual. Sobre una reserva que vino de Airbnb esto es un arreglo
 * temporal: la próxima importación la pisa con lo que diga el archivo
 * (§2.10.bis). La pantalla lo advierte antes de editar.
 */
export async function editarReserva(
  id: string,
  fd: FormData,
): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  if (!(await puedeEditarReservas(supabase))) {
    return { error: "Solo coordinación, manager y administración pueden editar reservas." };
  }

  const { data: actual } = await supabase
    .from("reservas")
    .select("id, codigo_reserva, origen, fecha_checkin, fecha_checkout, datos_completos")
    .eq("id", id)
    .maybeSingle();
  if (!actual) return { error: "No se encontró la reserva." };

  const datos = datosDelFormulario(fd);

  const errores = validarReserva({
    origen: "airbnb",
    codigo_reserva: actual.codigo_reserva,
    depto_id: datos.depto_id,
    fecha_checkin: datos.fecha_checkin,
    fecha_checkout: datos.fecha_checkout,
    huesped_nombre: datos.huesped_nombre,
    adultos: datos.adultos,
  });
  if (errores.length > 0) return { error: errores.join(" ") };

  const { error } = await supabase
    .from("reservas")
    .update({
      ...datos,
      noches: calcularNoches(datos.fecha_checkin, datos.fecha_checkout),
      // Una reserva del calendario a la que se le completaron los datos deja
      // de ser tentativa: ya tiene nombre y teléfono de verdad.
      datos_completos:
        actual.datos_completos || datos.huesped_contacto !== null,
    })
    .eq("id", id);

  if (error) return { error: `No se pudo guardar: ${error.message}` };

  // Si se movieron las fechas, la limpieza se reacomoda sola, con las mismas
  // reglas del importador (no toca una limpieza en curso o hecha).
  const cambiaronFechas =
    datos.fecha_checkin !== actual.fecha_checkin ||
    datos.fecha_checkout !== actual.fecha_checkout;

  if (cambiaronFechas) {
    try {
      await generarLimpiezas(supabase, [actual.codigo_reserva], hoyAR());
    } catch (e) {
      return {
        error: `Los datos se guardaron pero la limpieza no se pudo reacomodar: ${
          e instanceof Error ? e.message : "error desconocido"
        }`,
      };
    }
  }

  revalidatePath("/dia");
  revalidatePath("/semana");
  revalidatePath(`/reservas/${id}/editar`);
  return { ok: "Guardado." };
}

/**
 * Descartar una reserva que nunca se concretó (§2.10.ter). Solo manager y
 * administración. No se borra: sale de la operación junto con su check-in,
 * su check-out y su limpieza, y si más adelante aparece en un archivo de
 * Airbnb vuelve sola.
 */
export async function descartarReserva(id: string): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  if (!(await esManagerOAdmin(supabase))) {
    return { error: "Solo manager y administración pueden descartar una reserva." };
  }

  const resultado = await descartarReservaEnBase(supabase, id, hoyAR());
  if ("error" in resultado) return resultado;

  revalidar(id);

  const limpiezas =
    resultado.limpiezasCanceladas === 0
      ? "No tenía limpiezas pendientes."
      : resultado.limpiezasCanceladas === 1
        ? "También se canceló su limpieza."
        : `También se cancelaron sus ${resultado.limpiezasCanceladas} limpiezas.`;

  return {
    ok:
      `Reserva descartada. Salieron del día el check-in y el check-out. ${limpiezas}` +
      avisos(resultado.anomalias),
  };
}

/** Deshacer el descarte: la reserva vuelve a la operación, entera. */
export async function recuperarReserva(id: string): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  if (!(await esManagerOAdmin(supabase))) {
    return { error: "Solo manager y administración pueden recuperar una reserva." };
  }

  const resultado = await recuperarReservaEnBase(supabase, id, hoyAR());
  if ("error" in resultado) return resultado;

  revalidar(id);
  return {
    ok:
      "Reserva recuperada. Volvieron el check-in, el check-out y la limpieza." +
      avisos(resultado.anomalias),
  };
}
