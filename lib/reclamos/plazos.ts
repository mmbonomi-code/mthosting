/**
 * Plazos de un reclamo a Airbnb (docs/FASE-1-RECLAMOS-ESPECIFICACION.md §2).
 *
 * Los dos relojes arrancan el día del check-out de la reserva —el de Airbnb,
 * no el que se haya coordinado a mano, porque es el que Airbnb mira:
 *
 *   - 14 días para presentar el caso en el Centro de resoluciones.
 *   - 30 días para escalarlo a AirCover, si el huésped no pagó.
 *
 * Cuál de los dos corre depende del estado. Un reclamo ya resuelto no tiene
 * plazo: no hay nada que hacer a tiempo.
 *
 * Nada de esto se guarda en la base: se calcula del check-out. Una fecha
 * límite guardada es una segunda versión de la verdad, y la que queda vieja
 * es siempre la guardada.
 *
 * Funciones puras, con tests: no tocan la base ni preguntan qué día es hoy.
 */

import { sumarDias } from "../fechas";

export type EstadoReclamo =
  | "borrador"
  | "por_presentar"
  | "presentado"
  | "escalado"
  | "cobrado"
  | "rechazado"
  | "descartado";

export const DIAS_PARA_PRESENTAR = 14;
export const DIAS_PARA_ESCALAR = 30;

/** A partir de acá se avisa: el plazo vence en 3 días o menos. */
export const DIAS_DE_AVISO = 3;

/** Estados donde todavía queda algo por hacer contra un reloj. */
const ESPERANDO_PRESENTAR: ReadonlySet<EstadoReclamo> = new Set([
  "borrador",
  "por_presentar",
]);

/** Ya se presentó y el huésped no pagó: corre el plazo de AirCover. */
const ESPERANDO_AIRCOVER: ReadonlySet<EstadoReclamo> = new Set(["presentado"]);

export type Plazos = {
  /** Último día para presentar en el Centro de resoluciones. */
  limite_resolucion: string;
  /** Último día para escalar a AirCover. */
  limite_aircover: string;
  /** El que corre ahora, según el estado. `null` si ya no corre ninguno. */
  limite_vigente: string | null;
};

/** Las dos fechas límite y cuál está corriendo. */
export function plazosDeReclamo(
  fechaCheckout: string,
  estado: EstadoReclamo,
): Plazos {
  const limite_resolucion = sumarDias(fechaCheckout, DIAS_PARA_PRESENTAR);
  const limite_aircover = sumarDias(fechaCheckout, DIAS_PARA_ESCALAR);

  return {
    limite_resolucion,
    limite_aircover,
    limite_vigente: ESPERANDO_PRESENTAR.has(estado)
      ? limite_resolucion
      : ESPERANDO_AIRCOVER.has(estado)
        ? limite_aircover
        : null,
  };
}

/**
 * Días que faltan para una fecha límite. Cero es "vence hoy", negativo es
 * "ya venció". `hoy` se pasa siempre desde afuera (hoyAR), nunca se lee acá.
 */
export function diasRestantes(limite: string, hoy: string): number {
  return (Date.parse(`${limite}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000;
}

export type Semaforo = "vencido" | "urgente" | "proximo" | "tranquilo" | "sin_plazo";

/**
 * El color del plazo:
 *   vencido   — ya pasó la fecha
 *   urgente   — vence hoy o dentro de 3 días
 *   proximo   — entre 4 y 7 días
 *   tranquilo — más de 7 días
 *   sin_plazo — el reclamo ya está resuelto o descartado
 */
export function semaforoDeReclamo(
  fechaCheckout: string | null,
  estado: EstadoReclamo,
  hoy: string,
): { semaforo: Semaforo; limite: string | null; dias: number | null } {
  if (!fechaCheckout) return { semaforo: "sin_plazo", limite: null, dias: null };

  const { limite_vigente } = plazosDeReclamo(fechaCheckout, estado);
  if (!limite_vigente) return { semaforo: "sin_plazo", limite: null, dias: null };

  const dias = diasRestantes(limite_vigente, hoy);
  const semaforo: Semaforo =
    dias < 0
      ? "vencido"
      : dias <= DIAS_DE_AVISO
        ? "urgente"
        : dias <= 7
          ? "proximo"
          : "tranquilo";

  return { semaforo, limite: limite_vigente, dias };
}

/** Los que hay que mirar hoy: ya vencidos o a 3 días o menos. */
export function requiereAtencion(semaforo: Semaforo): boolean {
  return semaforo === "vencido" || semaforo === "urgente";
}

/** Cómo se dice en pantalla, con el número de días adentro. */
export function textoDePlazo(dias: number | null): string {
  if (dias === null) return "Sin plazo";
  if (dias < 0) {
    const pasados = Math.abs(dias);
    return `Vencido hace ${pasados} día${pasados === 1 ? "" : "s"}`;
  }
  if (dias === 0) return "Vence hoy";
  if (dias === 1) return "Vence mañana";
  return `Vence en ${dias} días`;
}

/** Clases del borde izquierdo, igual que el semáforo de las limpiezas. */
export const BORDE_SEMAFORO: Record<Semaforo, string> = {
  vencido: "border-l-red-500",
  urgente: "border-l-red-600",
  proximo: "border-l-amber-600",
  tranquilo: "border-l-slate-700",
  sin_plazo: "border-l-slate-800",
};

/** Colores del texto del plazo. */
export const TEXTO_SEMAFORO: Record<Semaforo, string> = {
  vencido: "text-red-300",
  urgente: "text-red-300",
  proximo: "text-amber-300",
  tranquilo: "text-slate-400",
  sin_plazo: "text-slate-500",
};
