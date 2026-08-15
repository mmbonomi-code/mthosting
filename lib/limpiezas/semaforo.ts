/**
 * Semáforo por proximidad (spec §3.2 y §3.3).
 *
 * Una limpieza sin responsable es más urgente cuanto más cerca está:
 *   - para hoy o mañana → rojo
 *   - a dos o tres días → ámbar
 *   - más adelante → gris, pero visible
 * Ya asignada, deja de gritar.
 */

export type Semaforo = "asignada" | "rojo" | "ambar" | "gris";

/** Días de diferencia entre dos fechas `yyyy-mm-dd`, sin zonas horarias. */
export function diasEntre(desde: string, hasta: string): number {
  const [a1, m1, d1] = desde.split("-").map(Number);
  const [a2, m2, d2] = hasta.split("-").map(Number);
  return (
    (Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000
  );
}

export function semaforoDeLimpieza({
  fecha,
  hoy,
  tieneResponsable,
}: {
  fecha: string;
  hoy: string;
  tieneResponsable: boolean;
}): Semaforo {
  if (tieneResponsable) return "asignada";

  const dias = diasEntre(hoy, fecha);
  // Lo que ya pasó sin asignar es tan urgente como lo de mañana.
  if (dias <= 1) return "rojo";
  if (dias <= 3) return "ambar";
  return "gris";
}

/**
 * El filete izquierdo de la fila (docs/IDENTIDAD-VISUAL.md).
 *
 * Solo grita lo que falta hacer. Una limpieza YA ASIGNADA lleva el borde
 * neutro a propósito: si todo lleva color, no se ve nada, y lo que hay que
 * mirar en esta pantalla es lo que todavía no tiene responsable.
 */
export const BORDE_SEMAFORO: Record<Semaforo, string> = {
  asignada: "border-l-borde",
  rojo: "border-l-accent",
  ambar: "border-l-accent",
  gris: "border-l-borde-fuerte",
};

/**
 * El fondo de la fila. Solo el rojo lo lleva: es la señal fuerte, la que se
 * ve de un vistazo sin leer. Una sola alarma por fila — el fondo va con el
 * filete, nunca además con un badge rojo encima.
 */
export const FONDO_SEMAFORO: Record<Semaforo, string> = {
  asignada: "",
  rojo: "bg-accent-soft",
  ambar: "",
  gris: "",
};

export type CargaPersona = {
  personaId: string;
  nombre: string;
  cantidad: number;
  monto: number;
  moneda: string | null;
};

/**
 * Cuánto lleva cada persona en el período: cantidad de limpiezas y plata
 * acumulada. Es lo que se mira antes de darle una más a alguien.
 */
export function cargaPorPersona(
  limpiezas: {
    asignado_a: string | null;
    monto_pactado: number | null;
    moneda: string | null;
    responsable: { nombre: string } | null;
  }[],
): CargaPersona[] {
  const porPersona = new Map<string, CargaPersona>();

  for (const l of limpiezas) {
    if (!l.asignado_a) continue;
    const actual = porPersona.get(l.asignado_a) ?? {
      personaId: l.asignado_a,
      nombre: l.responsable?.nombre ?? "Sin nombre",
      cantidad: 0,
      monto: 0,
      moneda: l.moneda,
    };
    actual.cantidad += 1;
    actual.monto += l.monto_pactado ?? 0;
    actual.moneda ??= l.moneda;
    porPersona.set(l.asignado_a, actual);
  }

  return [...porPersona.values()].sort((a, b) => b.cantidad - a.cantidad);
}
