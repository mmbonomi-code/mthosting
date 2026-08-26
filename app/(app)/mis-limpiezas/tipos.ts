/**
 * Constantes y tipos que NO pueden vivir en acciones.ts: un archivo
 * `"use server"` solo puede exportar funciones async, y cualquier otra
 * exportación rompe el módulo entero en tiempo de ejecución.
 */

/** Bucket privado de fotos y comprobantes. Nada se sirve por link público. */
export { BUCKET_LIMPIEZAS as BUCKET } from "@/lib/limpiezas/storage";

export type EstadoFormulario = { error: string } | { ok: string } | null;
