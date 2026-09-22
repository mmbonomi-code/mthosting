import { clsBoton, type TamanoBoton, type VarianteBoton } from "@/lib/ui";

/**
 * El botón de la identidad (docs/IDENTIDAD-VISUAL.md). Las clases viven en
 * `lib/ui.ts` para que un `<Link>` que hace de botón quede igual sin tener
 * que envolverlo: `className={clsBoton("secundario")}`.
 */
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
