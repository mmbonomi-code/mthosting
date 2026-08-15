/**
 * La tabla de la identidad (docs/IDENTIDAD-VISUAL.md §5, §8.1 y §8.3).
 *
 * La app no tiene ninguna `<table>`: todo son tarjetas apiladas. Anda bien en
 * el celular, pero para 50 departamentos en el escritorio hace falta una
 * tabla de verdad, con fila de 40px, encabezado propio y cifras alineadas.
 *
 * Tres cosas que resuelve y que si se dejan a cada pantalla salen distintas:
 *
 *  - El ancho. Una tabla ancha se desborda y hace que TODA la página se
 *    mueva de costado. Acá el desborde queda encerrado en su propio marco.
 *  - Las cifras. `tabular-nums` en toda la tabla, así los importes y las
 *    fechas alinean columna a columna en vez de bailar.
 *  - La fila que hay que mirar. Se pinta con `destacada`, que respeta la
 *    regla de una sola alarma por fila.
 */

export function Tabla({
  children,
  minimo = "40rem",
}: {
  children: React.ReactNode;
  /** Debajo de este ancho la tabla se desplaza en vez de apretujarse. */
  minimo?: string;
}) {
  return (
    <div className="overflow-x-auto rounded border border-borde bg-superficie">
      <table
        className="w-full border-collapse text-left text-[13px] tabular-nums"
        style={{ minWidth: minimo }}
      >
        {children}
      </table>
    </div>
  );
}

export function Encabezado({ children }: { children: React.ReactNode }) {
  return (
    <thead className="bg-superficie-alt">
      <tr>{children}</tr>
    </thead>
  );
}

export function Th({
  children,
  derecha,
}: {
  children: React.ReactNode;
  /** Los montos van a la derecha, como en cualquier planilla. */
  derecha?: boolean;
}) {
  return (
    <th
      scope="col"
      className={`border-b border-borde px-3 py-2 font-semibold text-warm-700 ${
        derecha ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

export function Fila({
  children,
  destacada,
  onClick,
}: {
  children: React.ReactNode;
  /** Clases de `FILA_VENCE` o equivalente. Una sola alarma por fila. */
  destacada?: string;
  onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={`h-fila border-b border-borde last:border-0 odd:bg-warm-50 hover:bg-superficie-hover ${
        onClick ? "cursor-pointer" : ""
      } ${destacada ?? ""}`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  derecha,
  tenue,
}: {
  children: React.ReactNode;
  derecha?: boolean;
  /** Columnas de apoyo: metadatos que no son el dato principal. */
  tenue?: boolean;
}) {
  return (
    <td
      className={`px-3 py-0 ${derecha ? "text-right" : ""} ${
        tenue ? "text-tinta-suave" : "text-tinta"
      }`}
    >
      {children}
    </td>
  );
}

/** Cuando no hay nada que mostrar, se dice — no se deja la tabla vacía. */
export function SinFilas({
  columnas,
  children,
}: {
  columnas: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={columnas} className="px-3 py-8 text-center text-tinta-tenue">
        {children}
      </td>
    </tr>
  );
}
