/**
 * Cuándo una reseña genera alerta (docs/CALIDAD-ESPECIFICACION.md §3.7).
 *
 * Decisiones del dueño, 06-07/10/2026:
 *
 *   - Puntaje general de 3 o menos.
 *   - Alguna categoría de 2 o menos.
 *   - 4 estrellas con alguna etiqueta negativa: es la reseña que se escapa
 *     del umbral y sin embargo dice "el baño estaba sucio".
 *
 * PURA: la usan la previa de la importación y la bandeja de alertas, y tienen
 * que contar lo mismo.
 */

import { CATEGORIAS, type Categoria } from "./parser";

export type MotivoAlerta = "general_baja" | "categoria_baja" | "cuatro_con_queja";

export type DatosAlerta = {
  puntaje_general: number;
  puntajes: Record<Categoria, number | null>;
  /** Textos de las etiquetas negativas, de cualquier categoría. */
  negativas: string[];
};

export const UMBRAL_GENERAL = 3;
export const UMBRAL_CATEGORIA = 2;

export function motivoAlerta(r: DatosAlerta): MotivoAlerta | null {
  if (r.puntaje_general <= UMBRAL_GENERAL) return "general_baja";
  if (CATEGORIAS.some((c) => (r.puntajes[c] ?? 5) <= UMBRAL_CATEGORIA)) return "categoria_baja";
  if (r.puntaje_general === 4 && r.negativas.length > 0) return "cuatro_con_queja";
  return null;
}

/**
 * Lo que se revisó, para `resena_revisada.firma`: los puntajes y las quejas.
 * Si una carga posterior cambia alguno, la firma deja de coincidir y la
 * alerta vuelve (mismo criterio que `alerta_revisada`).
 */
export function firmaAlerta(r: DatosAlerta): string {
  const puntajes = CATEGORIAS.map((c) => r.puntajes[c] ?? "-").join("");
  const quejas = [...r.negativas].sort().join("|");
  return `${r.puntaje_general}:${puntajes}:${quejas}`;
}
