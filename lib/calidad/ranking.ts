/**
 * El ranking del personal de limpieza (docs/CALIDAD-ESPECIFICACION.md §5.2).
 *
 * Cada reseña cuenta para quien hizo la limpieza anterior a la estadía
 * (vista `resenas_atribuidas`). Se ordena por el puntaje de limpieza, pero
 * solo entra al orden quien tiene una cantidad mínima de reseñas en el
 * período: un único 5 no puede quedar arriba de cuarenta reseñas de 4,9.
 *
 * PURA: una pasada por las reseñas.
 */

export type ResenaRanking = {
  id: string;
  responsable_id: string | null;
  puntaje_limpieza: number | null;
  /** Etiquetas negativas de la categoría limpieza. */
  quejasLimpieza: string[];
};

export type FilaRanking = {
  persona_id: string;
  nombre: string;
  /** Reseñas con puntaje de limpieza. */
  resenas: number;
  promedio: number;
  /** Porcentaje con 5 en limpieza (0 a 100). */
  cinco: number;
  /** Reseñas con limpieza de 3 o menos. */
  bajas: number;
  /** Reseñas con alguna etiqueta negativa de limpieza. */
  conQueja: number;
};

export type Ranking = {
  /** Con el mínimo de reseñas, ordenadas de mejor a peor. */
  enOrden: FilaRanking[];
  /** Por debajo del mínimo: se muestran aparte y sin posición. */
  pocas: FilaRanking[];
  /** Reseñas del período sin responsable de la limpieza anterior. */
  sinAtribuir: number;
};

export const MINIMO_RESENAS_RANKING = 10;
export const LIMPIEZA_BAJA = 3;

export function armarRanking(
  resenas: ResenaRanking[],
  personas: { id: string; nombre: string }[],
  minimo = MINIMO_RESENAS_RANKING,
): Ranking {
  const nombreDe = new Map(personas.map((p) => [p.id, p.nombre]));
  const acum = new Map<string, { n: number; suma: number; cinco: number; bajas: number; conQueja: number }>();
  let sinAtribuir = 0;

  for (const r of resenas) {
    if (!r.responsable_id) {
      sinAtribuir++;
      continue;
    }
    if (r.puntaje_limpieza === null) continue;
    const a = acum.get(r.responsable_id) ?? { n: 0, suma: 0, cinco: 0, bajas: 0, conQueja: 0 };
    a.n++;
    a.suma += r.puntaje_limpieza;
    if (r.puntaje_limpieza === 5) a.cinco++;
    if (r.puntaje_limpieza <= LIMPIEZA_BAJA) a.bajas++;
    if (r.quejasLimpieza.length > 0) a.conQueja++;
    acum.set(r.responsable_id, a);
  }

  const filas: FilaRanking[] = [...acum.entries()].map(([id, a]) => ({
    persona_id: id,
    nombre: nombreDe.get(id) ?? "Sin nombre",
    resenas: a.n,
    promedio: a.suma / a.n,
    cinco: (a.cinco / a.n) * 100,
    bajas: a.bajas,
    conQueja: a.conQueja,
  }));
  const orden = (x: FilaRanking, y: FilaRanking) =>
    y.promedio - x.promedio || y.resenas - x.resenas || x.nombre.localeCompare(y.nombre);

  return {
    enOrden: filas.filter((f) => f.resenas >= minimo).sort(orden),
    pocas: filas.filter((f) => f.resenas < minimo).sort(orden),
    sinAtribuir,
  };
}
