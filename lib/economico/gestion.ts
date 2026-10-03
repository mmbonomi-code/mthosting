/**
 * Qué filas de un export son de antes de que el depto entrara en gestión.
 *
 * Es la misma regla que `aplicar_en_gestion_desde()` en la base (migración
 * 20261003100000): esa la aplica sobre lo ya importado cuando cambia la
 * fecha; esta, sobre lo que llega en un archivo nuevo. Si se cambia una, se
 * cambia la otra.
 *
 * - Una fila de detalle queda fuera si su depto tiene fecha de alta y la
 *   estadía empieza antes (sin fecha de inicio, se mira la fecha del
 *   movimiento).
 * - Un payout queda fuera si TODAS las filas de detalle de su grupo quedaron
 *   fuera. Si mezcla una reserva nuestra, se queda.
 */

type Fila = {
  fecha: string;
  fecha_inicio: string | null;
  es_payout: boolean;
  grupo_payout: number | null;
};

/** Devuelve las posiciones (dentro de `filas`) que quedan fuera de gestión. */
export function filasFueraDeGestion<F extends Fila>(
  filas: F[],
  deptoDe: (fila: F) => string | null,
  desdePorDepto: Map<string, string>,
): Set<number> {
  const fuera = new Set<number>();
  // Por grupo: ¿hay detalle? ¿quedó alguno adentro?
  const grupos = new Map<number, { detalle: number; adentro: number }>();

  filas.forEach((f, i) => {
    if (f.es_payout) return;
    const depto = deptoDe(f);
    const desde = depto ? desdePorDepto.get(depto) : undefined;
    // Fechas ISO: la comparación de texto es la de calendario.
    const esFuera = desde !== undefined && (f.fecha_inicio ?? f.fecha) < desde;
    if (esFuera) fuera.add(i);

    if (f.grupo_payout !== null) {
      const g = grupos.get(f.grupo_payout) ?? { detalle: 0, adentro: 0 };
      g.detalle++;
      if (!esFuera) g.adentro++;
      grupos.set(f.grupo_payout, g);
    }
  });

  filas.forEach((f, i) => {
    if (!f.es_payout || f.grupo_payout === null) return;
    const g = grupos.get(f.grupo_payout);
    if (g && g.detalle > 0 && g.adentro === 0) fuera.add(i);
  });

  return fuera;
}
