/**
 * El bucket de las fotos de logística (la llave en el candado). Privado: se
 * sirve siempre por URL firmada desde el servidor, nunca por link público.
 *
 * Vive en `lib/` porque lo usan dos pantallas: la de logística, que sube la
 * foto, y la ficha de la llegada en el Día, que la muestra.
 */
export const BUCKET_LOGISTICA = "logistica";
