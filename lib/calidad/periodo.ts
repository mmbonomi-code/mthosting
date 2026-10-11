/**
 * El período de Calidad. Se mira por fecha de CHECK-OUT: la reseña es de la
 * estadía que termina ese día.
 *
 * PURA: recibe "hoy" (de lib/fechas.ts, en Buenos Aires) y los parámetros de
 * la URL. Las fechas son `yyyy-mm-dd` y ambos extremos son inclusivos.
 */

import { sumarDias } from "../fechas";

export type ParamsPeriodo = { p?: string; desde?: string; hasta?: string };

export type Periodo = {
  /** Clave del atajo elegido, o "rango" si se eligieron fechas. */
  clave: "90" | "anio" | "todo" | "rango";
  desde: string;
  hasta: string;
  etiqueta: string;
};

/** Antes de esta fecha no hay reservas en el sistema: la tasa no se puede calcular. */
export const TASA_DESDE = "2026-07-01";
/** Días que tiene el huésped para dejar reseña (Airbnb). */
export const PLAZO_RESENA_DIAS = 14;
/** Para "Todo": antes de esto no hay nada. */
const PRINCIPIO = "2020-01-01";

const esFecha = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function resolverPeriodo(params: ParamsPeriodo, hoy: string): Periodo {
  if (esFecha(params.desde) && esFecha(params.hasta) && params.desde <= params.hasta) {
    return { clave: "rango", desde: params.desde, hasta: params.hasta, etiqueta: "Rango elegido" };
  }
  if (params.p === "anio") {
    return { clave: "anio", desde: `${hoy.slice(0, 4)}-01-01`, hasta: hoy, etiqueta: "Este año" };
  }
  if (params.p === "todo") {
    return { clave: "todo", desde: PRINCIPIO, hasta: hoy, etiqueta: "Todo" };
  }
  return { clave: "90", desde: sumarDias(hoy, -89), hasta: hoy, etiqueta: "Últimos 90 días" };
}

/**
 * Qué estadías entran en la tasa de reseñas: las que terminaron dentro del
 * período, desde que hay reservas en el sistema, y hace más de 14 días (las
 * más recientes todavía pueden recibir su reseña y bajarían la tasa en falso).
 * Null si no queda ningún día.
 */
export function ventanaTasa(periodo: Periodo, hoy: string): { desde: string; hasta: string } | null {
  const desde = periodo.desde > TASA_DESDE ? periodo.desde : TASA_DESDE;
  const tope = sumarDias(hoy, -(PLAZO_RESENA_DIAS + 1));
  const hasta = periodo.hasta < tope ? periodo.hasta : tope;
  return desde <= hasta ? { desde, hasta } : null;
}
