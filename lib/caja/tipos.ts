/**
 * Tipos compartidos del módulo de caja.
 *
 * Viven acá y no en el archivo de acciones porque en un archivo `"use server"`
 * solo se pueden exportar funciones async: cualquier otra exportación rompe
 * el módulo entero en tiempo de ejecución.
 */

export type EstadoFormulario = { error: string } | { ok: string } | null;

/** Bucket privado de los comprobantes. */
export const BUCKET_COMPROBANTES = "comprobantes";

/** Las formas de cobro que usa la operación, sacadas del histórico real. */
export const FORMAS_COBRO = [
  "CUENTA CORRIENTE",
  "TRANSFERENCIA",
  "COBRO AIRBNB",
] as const;
