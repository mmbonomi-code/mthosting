/**
 * Tipos compartidos del módulo de caja.
 *
 * Viven acá y no en el archivo de acciones porque en un archivo `"use server"`
 * solo se pueden exportar funciones async: cualquier otra exportación rompe
 * el módulo entero en tiempo de ejecución.
 */

/**
 * `aviso` es el caso raro: lo cargado es sospechoso pero puede ser cierto,
 * así que no se guarda todavía y se ofrece confirmarlo. Viaja con el valor
 * que se revisó, para que confirmar valga solo por ESE valor y no por lo que
 * haya quedado en el campo después.
 */
export type EstadoFormulario =
  | { error: string }
  | { ok: string }
  | { aviso: string; confirmando: string }
  | null;

/** Bucket privado de los comprobantes. */
export const BUCKET_COMPROBANTES = "comprobantes";

/** Las formas de cobro que usa la operación, sacadas del histórico real. */
export const FORMAS_COBRO = [
  "CUENTA CORRIENTE",
  "TRANSFERENCIA",
  "COBRO AIRBNB",
] as const;
