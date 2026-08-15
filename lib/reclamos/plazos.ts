/**
 * Plazos de un reclamo a Airbnb (docs/FASE-1-RECLAMOS-ESPECIFICACION.md §2).
 *
 * Los dos relojes arrancan el día del check-out de la reserva —el de Airbnb,
 * no el que se haya coordinado a mano, porque es el que Airbnb mira:
 *
 *   - 13 días para presentar el caso en el Centro de resoluciones.
 *   - 30 días para escalarlo a AirCover, si el huésped no pagó.
 *
 * Airbnb cierra la presentación a los 14 días. Acá se usan 13 a propósito
 * (decisión del dueño, 11/08/2026): el sistema vence un día antes que el
 * plazo real, para que quede margen si el aviso salta sobre la hora.
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
import {
  BORDE_PLAZO as BORDE_POR_PLAZO,
  TONO_PLAZO,
  type Plazo,
  type Tono,
} from "../estados";

export type EstadoReclamo =
  | "borrador"
  | "por_presentar"
  | "presentado"
  | "escalado"
  | "cobrado"
  | "rechazado"
  | "descartado";

/** Un día menos que los 14 reales de Airbnb, a propósito. */
export const DIAS_PARA_PRESENTAR = 13;

/** El plazo real de Airbnb, para poder decirlo en pantalla. */
export const DIAS_REALES_AIRBNB = 14;
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

/**
 * El color sale del mapa único (`lib/estados.ts`). Acá solo se traduce el
 * nombre: este semáforo distingue "vencido" de "urgente" —ya se pasó contra
 * está por pasarse— y el mapa los llama vencido y hoy.
 */
const COMO_PLAZO: Record<Semaforo, Plazo> = {
  vencido: "vencido",
  urgente: "hoy",
  proximo: "proximo",
  tranquilo: "tranquilo",
  sin_plazo: "sin_plazo",
};

/** Clases del borde izquierdo, igual que el semáforo de las limpiezas. */
export const BORDE_SEMAFORO: Record<Semaforo, string> = Object.fromEntries(
  Object.entries(COMO_PLAZO).map(([s, p]) => [s, BORDE_POR_PLAZO[p]]),
) as Record<Semaforo, string>;

/** La píldora del plazo: fondo y texto juntos, no un color de texto suelto. */
export const TONO_SEMAFORO: Record<Semaforo, Tono> = Object.fromEntries(
  Object.entries(COMO_PLAZO).map(([s, p]) => [s, TONO_PLAZO[p]]),
) as Record<Semaforo, Tono>;
