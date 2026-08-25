/**
 * "Días sin limpiar" y "hace cuántos días se hizo": la misma cuenta, dos
 * usos. Spec §3.1 (columna informativa de escritorio) y la vista de
 * limpiadora (Fase 2), donde además decide si una tarea periódica está
 * vencida.
 */

import { diasEntre } from "./semaforo";

/**
 * Días entre la fecha de referencia y la última limpieza `hecha` o
 * `verificada` de un departamento. `null` si nunca se limpió: no hay cuenta
 * que hacer, y "nunca" es distinto de "hace muchísimos días".
 */
export function diasSinLimpiar(
  ultimaFecha: string | null,
  fechaReferencia: string,
): number | null {
  if (!ultimaFecha) return null;
  return diasEntre(ultimaFecha, fechaReferencia);
}

/**
 * ¿Corresponde hacer una tarea periódica? Vencida si nunca se hizo, o si
 * pasaron al menos los días de su frecuencia desde la última vez.
 */
export function tareaPeriodicaVencida(
  diasDesde: number | null,
  frecuenciaDias: number,
): boolean {
  return diasDesde === null || diasDesde >= frecuenciaDias;
}
