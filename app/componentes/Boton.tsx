/**
 * Botones de la identidad (docs/IDENTIDAD-VISUAL.md §8.1 y §9).
 *
 * Se exportan las CLASES además del componente porque media app usa `<Link>`
 * para acciones que navegan, y un `<button>` no sirve ahí. Con las clases
 * sueltas, un enlace queda igual que un botón sin tener que envolverlo.
 *
 * No confundir con `lib/ui.ts`: eso es lo viejo, sigue en uso hasta que cada
 * pantalla se migre. Estos son los de la identidad.
 */

export type VarianteBoton = "primario" | "secundario" | "discreto";
export type TamanoBoton = "normal" | "grande";

const VARIANTE: Record<VarianteBoton, string> = {
  primario: "bg-primary text-tinta-inversa hover:bg-primary-hover active:bg-primary-active",
  secundario:
    "bg-superficie text-primary border border-primary hover:bg-primary-soft",
  // Para lo que acompaña y no compite: "Cancelar", "Ver todo".
  discreto: "text-tinta-suave hover:bg-superficie-hover",
};

const TAMANO: Record<TamanoBoton, string> = {
  // 34px es la altura de la identidad para acciones de escritorio.
  normal: "h-[34px] px-4 text-[12.5px]",
  // En el celular nada tocable baja de 44; la acción principal va a 48.
  grande: "h-12 px-5 text-base w-full",
};

export function clsBoton(
  variante: VarianteBoton = "primario",
  tamano: TamanoBoton = "normal",
): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-md font-medium",
    "transition-colors duration-150",
    "disabled:cursor-not-allowed disabled:opacity-45",
    VARIANTE[variante],
    TAMANO[tamano],
  ].join(" ");
}

export default function Boton({
  variante = "primario",
  tamano = "normal",
  className,
  ...props
}: {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`${clsBoton(variante, tamano)} ${className ?? ""}`}
    />
  );
}
