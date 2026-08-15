import type { Tono } from "@/lib/estados";

/**
 * El badge de estado (docs/IDENTIDAD-VISUAL.md §6).
 *
 * Recibe un tono del mapa único de `lib/estados.ts` y lo dibuja. No decide
 * colores: si hace falta uno nuevo, se agrega al mapa, no acá.
 *
 * La forma es la misma para los 19 estados —mismo radio, mismo cuerpo de 12px,
 * mismo padding— para que la diferencia entre uno y otro sea el color y el
 * texto, no el tamaño. La intensidad (fondo tenue o relleno sólido) también
 * la decide el tono, no este componente.
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
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium leading-tight ${tono.clases}`}
    >
      {/* Señal no cromática: el punto acompaña al color, no lo reemplaza.
          Toma el color del texto para que funcione en las dos intensidades:
          blanco sobre el relleno sólido, oscuro sobre el fondo tenue. */}
      {tono.punto && (
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}
