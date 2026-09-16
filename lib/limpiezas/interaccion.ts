/**
 * Lo que la limpieza tiene que saber del huésped que sale y del que entra.
 *
 * Hay dos momentos en que la limpieza trata con un huésped, y los dos se
 * avisan en su pantalla (decisión del dueño, 16/09/2026):
 *
 *  - Check-out con devolución "presencial – Limpieza": el huésped que sale le
 *    deja las llaves.
 *  - Check-in por un punto que la limpieza atiende ("valijas – En depto" o
 *    "presencial – Limpieza"): le dejan las valijas o lo recibe en persona.
 *
 * Además, "entra alguien ese día" se decide contra el día REAL de la
 * limpieza. La marca `urgente` guardada comparaba contra el check-out de la
 * reserva, y una limpieza movida a mano al día siguiente quedaba sin marca
 * aunque ese día entrara un huésped (KENNEDY 1, 16/09/2026).
 *
 * Función pura: la consulta vive en `interaccion-db.ts`.
 */

import { formatearHora } from "./etiquetas";

export const SIN_HORARIO = "Horario no informado";

/** El punto de acceso tal como llega de la base. */
export type PuntoInteraccion = { metodo: string; recibe_limpieza: boolean } | null;

export type DatosInteraccion = {
  fechaLimpieza: string;
  /** El check-out de la reserva de esta limpieza, si es una de salida. */
  salida: {
    fecha: string;
    hora: string | null;
    puntoDevolucion: PuntoInteraccion;
  } | null;
  /** El check-in de otra reserva del mismo depto ESE día, si hay. */
  entrada: {
    hora: string | null;
    punto: PuntoInteraccion;
  } | null;
};

export type AvisoEntrada = "valijas" | "en_persona" | null;

export type Interaccion = {
  salida: {
    /** Si salió otro día (late checkout, limpieza movida), esa fecha. */
    otroDia: string | null;
    hora: string;
    /** El huésped le deja las llaves a la limpieza. */
    dejaLlaves: boolean;
  } | null;
  entrada: {
    hora: string;
    aviso: AvisoEntrada;
  } | null;
};

export function resumirInteraccion(d: DatosInteraccion): Interaccion {
  const salida = d.salida
    ? {
        otroDia: d.salida.fecha !== d.fechaLimpieza ? d.salida.fecha : null,
        hora: formatearHora(d.salida.hora) ?? SIN_HORARIO,
        // Solo si sale ese mismo día: si salió antes, las llaves ya las
        // recibió otra persona. Y solo en persona: "valijas – En depto"
        // también está marcado, pero no es una forma de devolver llaves.
        dejaLlaves:
          d.salida.fecha === d.fechaLimpieza &&
          d.salida.puntoDevolucion?.metodo === "presencial" &&
          d.salida.puntoDevolucion.recibe_limpieza,
      }
    : null;

  const entrada = d.entrada
    ? {
        hora: formatearHora(d.entrada.hora) ?? SIN_HORARIO,
        aviso: avisoEntrada(d.entrada.punto),
      }
    : null;

  return { salida, entrada };
}

function avisoEntrada(punto: PuntoInteraccion): AvisoEntrada {
  if (!punto?.recibe_limpieza) return null;
  return punto.metodo === "valijas" ? "valijas" : "en_persona";
}

/** Para ordenar la lista: primero lo que tiene entrada ese día, por hora. */
export function claveOrden(i: Interaccion): string {
  if (!i.entrada) return "2";
  return i.entrada.hora === SIN_HORARIO ? "1" : `0${i.entrada.hora}`;
}
