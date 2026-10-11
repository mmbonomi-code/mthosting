/**
 * La bandeja de alertas de calidad (docs/CALIDAD-ESPECIFICACION.md §3.7 y
 * §5.3).
 *
 * Una reseña está en la bandeja si cumple la regla de alerta, no se dio por
 * revisada con la misma firma, y es reciente: solo alertan las reseñas con
 * check-out desde 30 días antes de la PRIMERA carga. Así la primera
 * importación no llena la bandeja con meses de historia (decisión del dueño,
 * 07/10/2026). Las viejas se pueden ver igual, pidiéndolas.
 *
 * PURA.
 */

import { sumarDias } from "../fechas";
import { firmaAlerta, motivoAlerta, type DatosAlerta, type MotivoAlerta } from "./alertas";

export const DIAS_ANTES_DE_LA_PRIMERA_CARGA = 30;

/** Desde qué check-out alertan las reseñas. Sin cargas, desde siempre. */
export function corteDeAlertas(primeraCarga: string | null): string | null {
  return primeraCarga ? sumarDias(primeraCarga, -DIAS_ANTES_DE_LA_PRIMERA_CARGA) : null;
}

export type AlertaCalidad<T> = { resena: T; motivo: MotivoAlerta; firma: string };

/**
 * Las reseñas que están en la bandeja, de la más reciente a la más vieja.
 * `incluirViejas` muestra también las anteriores al corte.
 */
export function alertasAbiertas<T extends DatosAlerta & { id: string; fecha_checkout: string }>(
  resenas: T[],
  revisadas: Map<string, string>,
  corte: string | null,
  incluirViejas = false,
): AlertaCalidad<T>[] {
  const abiertas: AlertaCalidad<T>[] = [];
  for (const r of resenas) {
    if (!incluirViejas && corte && r.fecha_checkout < corte) continue;
    const motivo = motivoAlerta(r);
    if (!motivo) continue;
    const firma = firmaAlerta(r);
    if (revisadas.get(r.id) === firma) continue;
    abiertas.push({ resena: r, motivo, firma });
  }
  return abiertas.sort(
    (a, b) => b.resena.fecha_checkout.localeCompare(a.resena.fecha_checkout) || a.resena.id.localeCompare(b.resena.id),
  );
}

/**
 * ¿La queja pide un arreglo? "Necesita mantenimiento" y las de equipamiento
 * roto o faltante ("Calefacción: Estaba roto o no se podía usar").
 */
export function pideArreglo(queja: string): boolean {
  return /mantenimiento|roto|no se pod[ií]a usar|faltaba|cerradura/i.test(queja);
}
