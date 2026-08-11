/**
 * Constantes y tipos del módulo que NO pueden vivir en el archivo de
 * acciones: en un archivo `"use server"` solo se exportan funciones async, y
 * cualquier otra exportación rompe el módulo entero en tiempo de ejecución.
 */

/** Bucket privado de la evidencia. Nada se sirve por link público. */
export const BUCKET = "reclamos";

export type EstadoFormulario = { error: string } | { ok: string } | null;

export type ReservaEncontrada = {
  id: string;
  codigo_reserva: string;
  huesped_nombre: string | null;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  depto: string | null;
  reclamo_id: string | null;
};
