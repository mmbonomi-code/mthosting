import type { Tono } from "@/lib/estados";
import { clsPastilla } from "@/lib/ui";

/**
 * La pastilla de estado (docs/IDENTIDAD-VISUAL.md §6).
 *
 * Recibe un tono del mapa único de `lib/estados.ts` y lo dibuja. No decide
 * colores: si hace falta uno nuevo, se agrega al mapa, no acá.
 *
 * La forma es la misma para todos los estados, para que la diferencia entre
 * uno y otro sea el color y el texto, no el tamaño.
 */
export default function Badge({
  tono,
  children,
  title,
}: {
  tono: Tono;
  children: React.ReactNode;
  /** Para explicar un estado que en dos palabras no se entiende. */
  title?: string;
}) {
  return (
    <span title={title} className={`${clsPastilla} ${tono.clases}`}>
      {/* Señal no cromática: el punto acompaña al color, no lo reemplaza. */}
      {tono.punto && (
        <span aria-hidden className="size-1.5 rounded-full bg-alerta-punto" />
      )}
      {children}
    </span>
  );
}
