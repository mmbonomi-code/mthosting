/**
 * El bucket de las fotos y comprobantes de una limpieza. Privado: todo se
 * sirve por URL firmada desde el servidor, nunca por link público.
 *
 * Vive en `lib/` y no en la pantalla porque lo necesitan los dos lados: la
 * vista de la limpiadora que sube las fotos, y los reclamos, que se llevan
 * una copia como evidencia.
 */
export const BUCKET_LIMPIEZAS = "limpiezas";
