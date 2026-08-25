/**
 * Constantes y tipos que NO pueden vivir en acciones.ts: un archivo
 * `"use server"` solo puede exportar funciones async, y cualquier otra
 * exportación rompe el módulo entero en tiempo de ejecución.
 */

/** Bucket privado de fotos y comprobantes. Nada se sirve por link público. */
export const BUCKET = "limpiezas";

export type EstadoFormulario = { error: string } | { ok: string } | null;
