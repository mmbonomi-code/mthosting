/**
 * Aviso de filas repetidas después de importar (17/10/2026).
 *
 * La deduplicación del importador compara huellas, y la huella depende del
 * contenido del archivo. Si Airbnb cambia cómo escribe algo —fue el caso con
 * el nombre de una publicación— la misma plata entra dos veces sin que nadie
 * se entere. Pasó con tres departamentos de Talcahuano: 547 filas repetidas
 * que inflaron todos los meses en mil dólares.
 *
 * Este control mira lo que entró con otros ojos: la MISMA PLATA es la misma
 * reserva, la misma categoría, la misma fecha de cobro y el mismo importe.
 * Dos filas así casi nunca son dos cobros de verdad. No bloquea la
 * importación ni borra nada: avisa, y la persona decide.
 *
 * Las filas sin código de confirmación —los payout— quedan afuera: ahí sí
 * existen dos cobros iguales el mismo día, y la huella los distingue por
 * archivo y por orden.
 *
 * Funciones puras, con tests.
 */

export type FilaComparable = {
  codigo_confirmacion: string | null;
  categoria: string;
  fecha: string;
  importe: number | null;
  anuncio: string | null;
};

export type Repetida = {
  clave: string;
  codigo: string;
  categoria: string;
  fecha: string;
  importe: number;
  /** Los nombres de anuncio con los que entró la misma plata. */
  anuncios: string[];
};

/** La misma plata: reserva, categoría, fecha de cobro e importe. */
export function clavePlata(f: FilaComparable): string | null {
  const codigo = (f.codigo_confirmacion ?? "").trim();
  if (codigo === "") return null;
  return [codigo, f.categoria, f.fecha, Number(f.importe ?? 0).toFixed(2)].join("|");
}

/**
 * Qué filas del lote repiten plata que ya estaba cargada.
 *
 * `nuevas` son las filas que entraron; `existentes`, las que ya había de
 * otras importaciones. Las dos listas llegan ya filtradas a las filas vivas:
 * una fila dada de baja no cuenta como duplicado de nada.
 */
export function detectarRepetidas(
  nuevas: FilaComparable[],
  existentes: FilaComparable[],
): Repetida[] {
  const anteriores = new Map<string, FilaComparable[]>();
  for (const f of existentes) {
    const k = clavePlata(f);
    if (k === null) continue;
    anteriores.set(k, [...(anteriores.get(k) ?? []), f]);
  }

  const encontradas = new Map<string, Repetida>();
  for (const f of nuevas) {
    const k = clavePlata(f);
    if (k === null) continue;
    const previas = anteriores.get(k);
    if (previas === undefined) continue;
    if (encontradas.has(k)) continue;
    const anuncios = [...new Set([...previas, f].map((x) => x.anuncio).filter((a): a is string => a !== null))];
    encontradas.set(k, {
      clave: k,
      codigo: (f.codigo_confirmacion ?? "").trim(),
      categoria: f.categoria,
      fecha: f.fecha,
      importe: Number(f.importe ?? 0),
      anuncios,
    });
  }

  return [...encontradas.values()].sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.codigo.localeCompare(b.codigo),
  );
}

/** El aviso en palabras, o `null` si no hay nada que decir. */
export function textoDelAviso(repetidas: Repetida[]): string | null {
  if (repetidas.length === 0) return null;

  const ejemplos = repetidas
    .slice(0, 3)
    .map((r) => `${r.codigo} del ${r.fecha} por ${r.importe}`)
    .join("; ");

  // Si la misma plata entró con dos nombres de anuncio distintos, esa es la
  // explicación más probable y conviene decirla: es lo que ya pasó una vez.
  const conNombreDistinto = repetidas.filter((r) => r.anuncios.length > 1);
  const porNombre =
    conNombreDistinto.length > 0
      ? ` En ${conNombreDistinto.length} de ellas cambió el nombre del anuncio (por ejemplo "${conNombreDistinto[0].anuncios.join('" y "')}"): puede que le hayan cambiado el título a la publicación en Airbnb.`
      : "";

  return (
    `${repetidas.length} ${repetidas.length === 1 ? "fila repite" : "filas repiten"} plata que ya estaba cargada: ` +
    `misma reserva, misma categoría, misma fecha y mismo importe (${ejemplos}).${porNombre} ` +
    `Revisalas antes de mirar los números.`
  );
}
