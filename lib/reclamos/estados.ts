/**
 * El recorrido de un reclamo (docs/FASE-1-RECLAMOS-ESPECIFICACION.md §2).
 *
 *   borrador → por_presentar → presentado → escalado → cobrado
 *                                        ↘ cobrado
 *                                        ↘ rechazado
 *              ↘ descartado  (mientras no se haya presentado)
 *
 * Qué se pide en cada paso está acá y no repartido por las pantallas: es la
 * regla de negocio, no un detalle de la interfaz.
 *
 * Funciones puras, con tests.
 */

import type { EstadoReclamo } from "./plazos";

export const ETIQUETA_ESTADO: Record<EstadoReclamo, string> = {
  borrador: "Borrador",
  por_presentar: "Por presentar",
  presentado: "Presentado",
  escalado: "Escalado a AirCover",
  cobrado: "Cobrado",
  rechazado: "Rechazado",
  descartado: "Descartado",
};

/** Los que ya terminaron: no se tocan salvo que administración los reabra. */
export const ESTADOS_FINALES: ReadonlySet<EstadoReclamo> = new Set([
  "cobrado",
  "rechazado",
  "descartado",
]);

/** A dónde puede ir cada estado. */
const TRANSICIONES: Record<EstadoReclamo, readonly EstadoReclamo[]> = {
  borrador: ["por_presentar", "presentado", "descartado"],
  por_presentar: ["presentado", "descartado"],
  presentado: ["escalado", "cobrado", "rechazado"],
  escalado: ["cobrado", "rechazado"],
  cobrado: [],
  rechazado: [],
  descartado: [],
};

export function transicionesDe(estado: EstadoReclamo): readonly EstadoReclamo[] {
  return TRANSICIONES[estado];
}

export function puedeIr(desde: EstadoReclamo, hasta: EstadoReclamo): boolean {
  return TRANSICIONES[desde].includes(hasta);
}

export type CamposDeReclamo = {
  motivo: string | null;
  monto_reclamado: number | null;
};

/**
 * Qué falta para poder presentarlo. Un borrador existe justamente para lo
 * que está a medias, así que ahí no se exige nada; el monto y el motivo se
 * vuelven obligatorios recién al pasarlo a "por presentar" o más adelante
 * (decisión del dueño, 11/08/2026).
 */
export function faltaParaPresentar(campos: CamposDeReclamo): string[] {
  const faltan: string[] = [];
  if (!campos.motivo || campos.motivo.trim() === "") faltan.push("el motivo");
  if (campos.monto_reclamado === null || campos.monto_reclamado <= 0) {
    faltan.push("el monto reclamado");
  }
  return faltan;
}

export type CambioDeEstado = {
  estado: EstadoReclamo;
  presentado_at?: string;
  escalado_at?: string;
  resuelto_at?: string;
  monto_cobrado?: number;
};

/**
 * Los campos que hay que grabar junto con el cambio de estado. `ahora` se
 * pasa desde afuera para que la función siga siendo pura.
 */
export function camposAlCambiar(
  destino: EstadoReclamo,
  ahora: string,
  montoCobrado?: number,
): CambioDeEstado {
  switch (destino) {
    case "presentado":
      return { estado: destino, presentado_at: ahora };
    case "escalado":
      return { estado: destino, escalado_at: ahora };
    case "cobrado":
      return { estado: destino, resuelto_at: ahora, monto_cobrado: montoCobrado ?? 0 };
    case "rechazado":
      // Rechazado es cobrar cero, no "sin dato": deja el número escrito.
      return { estado: destino, resuelto_at: ahora, monto_cobrado: 0 };
    default:
      return { estado: destino };
  }
}

/** ¿Parece un link del caso en Airbnb? Avisa, no bloquea. */
export function pareceUrlDeAirbnb(url: string | null): boolean {
  if (!url || url.trim() === "") return true;
  return /^https?:\/\/([a-z0-9-]+\.)*airbnb\.[a-z.]+\//i.test(url.trim());
}
