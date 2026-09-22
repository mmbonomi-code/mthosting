/**
 * Las recetas de clases de la interfaz (docs/IDENTIDAD-VISUAL.md).
 *
 * Todo sale de los tokens de app/globals.css. Una pantalla que necesita un
 * botón, un campo o una tarjeta usa estas clases (o los componentes de
 * app/componentes/, que las envuelven) en vez de escribir las suyas: así un
 * cambio de la identidad se hace acá y llega a toda la app.
 *
 * Se exportan como clases y no solo como componentes porque media app usa
 * `<Link>` para acciones que navegan, y un `<button>` no sirve ahí.
 */

// ---------------------------------------------------------------------------
// Botones
// ---------------------------------------------------------------------------

export type VarianteBoton = "primario" | "secundario" | "discreto" | "peligro";
export type TamanoBoton = "chico" | "normal" | "grande" | "icono";

const VARIANTE: Record<VarianteBoton, string> = {
  primario:
    "bg-primary font-semibold text-tinta-inversa hover:bg-primary-hover active:bg-primary-active",
  secundario:
    "border border-borde-control font-medium text-tinta-suave hover:bg-elevada hover:text-tinta",
  // Para lo que acompaña y no compite: "Cancelar", "Ver todo".
  discreto: "font-medium text-tinta-tenue hover:bg-elevada hover:text-tinta",
  // Lo que no tiene vuelta atrás: cancelar una reserva, rechazar un reclamo.
  peligro: "bg-error-intenso font-semibold text-tinta hover:bg-error-borde",
};

const TAMANO: Record<TamanoBoton, string> = {
  // Acciones dentro de una fila o de una tarjeta: compacto en escritorio,
  // pero en el celular no baja de 44px.
  chico: "h-11 px-3 text-sm sm:h-9",
  // En el celular nada tocable baja de 44px.
  normal: "h-11 px-5 text-sm",
  // La acción principal de una pantalla de celular.
  grande: "h-12 px-5 text-base",
  // Cuadrado, para una flecha o una cruz. 44px: se toca con el dedo.
  icono: "size-11 text-base",
};

export function clsBoton(
  variante: VarianteBoton = "primario",
  tamano: TamanoBoton = "normal",
): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-lg",
    "transition-colors duration-150",
    "disabled:cursor-not-allowed disabled:opacity-45",
    VARIANTE[variante],
    TAMANO[tamano],
  ].join(" ");
}

export const clsBotonPrimario = clsBoton("primario");
export const clsBotonSecundario = clsBoton("secundario");

// ---------------------------------------------------------------------------
// Formularios
// ---------------------------------------------------------------------------

const CONTROL =
  "w-full rounded-lg border border-borde-control bg-elevada px-3 text-base text-tinta outline-none placeholder:text-tinta-etiqueta focus:border-primary aria-invalid:border-error";

export const clsEntrada = `h-11 ${CONTROL}`;

export const clsAreaTexto = `min-h-24 py-2 ${CONTROL}`;

export const clsEtiqueta = "text-sm font-medium text-tinta-suave";

// ---------------------------------------------------------------------------
// Contenedores y texto
// ---------------------------------------------------------------------------

/** La tarjeta de la app: el envase de casi todo en el celular. */
export const clsTarjeta = "rounded-xl border border-borde bg-superficie";

/** Pastilla de estado o de marca. El color sale de lib/estados.ts. */
export const clsPastilla =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium";

/** Un enlace dentro de un texto. */
export const clsEnlace =
  "text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary";

/** Título de pantalla. */
export const clsTitulo = "text-2xl font-semibold tracking-tight text-tinta";
