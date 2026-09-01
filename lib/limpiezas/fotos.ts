/**
 * Las categorías de foto de una limpieza, en un solo lugar.
 *
 * Estaban repetidas en la acción, en la cola, en el subidor y en las dos
 * pantallas: agregar una quinta obligaba a acordarse de cinco archivos. Acá
 * se agrega una sola vez.
 *
 * El orden es el que se ve en pantalla, y no es casual: primero lo que
 * siempre se hace (el depto terminado), después lo que a veces aparece.
 */

export const TIPOS_FOTO = ["terminado", "arreglar", "huesped", "olvido"] as const;

export type TipoFoto = (typeof TIPOS_FOTO)[number];

export const ETIQUETA_FOTO: Record<TipoFoto, string> = {
  terminado: "Depto terminado",
  arreglar: "Algo para arreglar",
  huesped: "Lo que dejó mal el huésped",
  olvido: "Se lo olvidó el huésped",
};

/** El texto que acompaña a cada categoría en la pantalla de la limpiadora. */
export const AYUDA_FOTO: Record<TipoFoto, string> = {
  terminado: "Hace falta al menos una para poder cerrar la limpieza.",
  arreglar: "Roturas o cosas que no funcionan.",
  huesped: "Daños o suciedad fuera de lo normal. Sirven para reclamarle a Airbnb.",
  olvido: "Cosas que se dejó olvidadas: ropa, cargadores, documentos.",
};
