/**
 * Clases compartidas de la interfaz.
 *
 * Estas cinco constantes las usan 39 pantallas: son los campos, las etiquetas
 * y los botones de todos los formularios. Pasarlas a los tokens de la
 * identidad convierte esas pantallas de una sola vez, sin tocar ninguna.
 *
 * Se conserva la GEOMETRÍA de antes —44px de alto, ancho completo— y se cambia
 * solo el color y el radio. Mover también las medidas correría el contenido de
 * cuarenta formularios a la vez, y eso sí habría que mirarlo uno por uno.
 *
 * Para pantallas nuevas está `app/componentes/Boton.tsx`, que sigue la altura
 * de 34px de la identidad (§8.1). Estas quedan para lo que ya existe.
 */

export const clsEntrada =
  "h-11 w-full rounded-md border border-borde-control bg-superficie px-3 text-base text-tinta outline-none placeholder:text-tinta-tenue focus:border-primary";

export const clsAreaTexto =
  "min-h-24 w-full rounded-md border border-borde-control bg-superficie px-3 py-2 text-base text-tinta outline-none placeholder:text-tinta-tenue focus:border-primary";

export const clsEtiqueta = "text-sm font-medium text-tinta-suave";

/** El primario es el verde de marca, no el blanco invertido del tema oscuro. */
export const clsBotonPrimario =
  "h-11 rounded-md bg-primary px-5 text-base font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover active:bg-primary-active disabled:opacity-45";

export const clsBotonSecundario =
  "h-11 rounded-md border border-primary bg-superficie px-5 text-base font-medium text-primary transition-colors hover:bg-primary-soft disabled:opacity-45";
