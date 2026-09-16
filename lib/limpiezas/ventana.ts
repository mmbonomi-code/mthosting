/**
 * La ventana de una limpieza de salida: si entra alguien el mismo día en que
 * se limpia (`urgente`) y cuándo llega el próximo huésped (`prox_checkin`).
 *
 * Se mide siempre desde el día en que se limpia DE VERDAD, que no siempre es
 * el del check-out: una persona pudo moverla (KENNEDY 1, 16/09/2026).
 *
 * Función pura. La usan el planificador, las acciones que cambian la fecha a
 * mano (vía `ventana-db.ts`) y `corregirVentanas`, que repasa las limpiezas
 * VECINAS de un lote: cuando entra una reserva nueva, la que queda con alguien
 * entrando es la limpieza del huésped anterior, y esa no es del lote.
 */

import type { LimpiezaCambio, LimpiezaExistente, ReservaPlan } from "./planificar";

export type Ventana = { urgente: boolean; prox_checkin: string | null };

/** `checkins`: las fechas de check-in de las OTRAS reservas vivas del depto. */
export function calcularVentana(fecha: string, checkins: (string | null)[]): Ventana {
  let prox: string | null = null;
  for (const c of checkins) {
    if (c !== null && c >= fecha && (prox === null || c < prox)) prox = c;
  }
  return {
    urgente: prox === fecha,
    prox_checkin: prox === null ? null : `${prox}T00:00:00`,
  };
}

/**
 * Los cambios de ventana de las limpiezas de salida vivas, contra las
 * reservas vivas de sus deptos. Solo devuelve lo que difiere de lo guardado.
 */
export function corregirVentanas(
  limpiezas: LimpiezaExistente[],
  reservasVivas: ReservaPlan[],
): LimpiezaCambio[] {
  const porDepto = new Map<string, ReservaPlan[]>();
  for (const r of reservasVivas) {
    if (!r.depto_id || r.cancelada || r.descartada) continue;
    if (!porDepto.has(r.depto_id)) porDepto.set(r.depto_id, []);
    porDepto.get(r.depto_id)!.push(r);
  }

  const cambios: LimpiezaCambio[] = [];
  for (const l of limpiezas) {
    if (l.rol_reserva !== "salida" || l.estado === "cancelada") continue;
    const checkins = (porDepto.get(l.depto_id) ?? [])
      .filter((r) => r.id !== l.reserva_id)
      .map((r) => r.fecha_checkin);
    const v = calcularVentana(l.fecha, checkins);

    const cambio: LimpiezaCambio = { id: l.id };
    if (v.urgente !== l.urgente) cambio.urgente = v.urgente;
    if (v.prox_checkin !== (l.prox_checkin ?? null)) cambio.prox_checkin = v.prox_checkin;
    if (Object.keys(cambio).length > 1) cambios.push(cambio);
  }
  return cambios;
}
