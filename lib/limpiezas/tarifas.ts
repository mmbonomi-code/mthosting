/**
 * Resolución de la tarifa de una limpieza (spec §1.1 y §3.2).
 *
 * Al asignar una limpieza se congela el monto: se resuelve la tarifa vigente
 * A ESA FECHA, se aplican las reglas de pago y el resultado se guarda en
 * `monto_pactado`. Nunca se recalcula solo: cargar tarifas nuevas no altera
 * lo ya asignado.
 *
 * Reglas de pago (decisión del dueño, 02/08/2026):
 *   - Pago DOBLE: limpieza inicial, limpieza profunda, domingos y feriados.
 *   - Repaso: se paga el 50%.
 * El pago doble es una marca, no se acumula: una inicial en domingo se paga
 * doble, no cuádruple. Un repaso en domingo combina las dos reglas
 * (2 × 0,5) y termina pagándose como una limpieza común.
 */

export type Tarifa = {
  id: string;
  ambientes: string | null;
  depto_id: string | null;
  monto: number;
  moneda: string;
  vigente_desde: string;
  vigente_hasta: string | null;
};

/** Tipos que se pagan doble por su naturaleza, cualquier día de la semana. */
const TIPOS_PAGO_DOBLE = new Set(["inicial", "profunda"]);

/** Tipos que se pagan a la mitad. */
const TIPOS_MEDIA_PAGA = new Set(["repaso"]);

/** ¿Esta limpieza se paga doble? Por el tipo, por domingo o por feriado. */
export function esPagoDoble(
  fecha: string,
  tipo: string,
  feriados: ReadonlySet<string>,
): boolean {
  if (TIPOS_PAGO_DOBLE.has(tipo)) return true;
  if (feriados.has(fecha)) return true;
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay() === 0;
}

/**
 * Busca la tarifa que corresponde. Rige desde su fecha de inicio, inclusive:
 * toda limpieza de esa fecha en adelante toma ese valor. Una tarifa puntual
 * del departamento le gana a la general por ambientes. Si no hay ninguna
 * vigente devuelve null: la limpieza se asigna igual, sin monto.
 */
export function resolverTarifa(
  tarifas: Tarifa[],
  criterio: { deptoId: string; ambientes: string | null; fecha: string },
): Tarifa | null {
  const vigentes = tarifas.filter(
    (t) =>
      t.vigente_desde <= criterio.fecha &&
      (t.vigente_hasta === null || t.vigente_hasta >= criterio.fecha),
  );

  const delDepto = vigentes.filter((t) => t.depto_id === criterio.deptoId);
  if (delDepto.length > 0) return masReciente(delDepto);

  const porAmbientes = vigentes.filter(
    (t) => t.depto_id === null && t.ambientes !== null && t.ambientes === criterio.ambientes,
  );
  if (porAmbientes.length > 0) return masReciente(porAmbientes);

  return null;
}

/** Ante varias vigentes, gana la que empezó a regir más tarde. */
function masReciente(tarifas: Tarifa[]): Tarifa {
  return tarifas.reduce((a, b) => (b.vigente_desde > a.vigente_desde ? b : a));
}

export type MontoCongelado = {
  monto_pactado: number | null;
  moneda: string | null;
  tarifa_id: string | null;
  pago_doble: boolean;
};

/**
 * El monto que se congela al asignar, ya con las reglas de pago aplicadas:
 * es lo que la persona va a cobrar por esa limpieza.
 */
export function congelarMonto(
  tarifas: Tarifa[],
  feriados: ReadonlySet<string>,
  criterio: {
    deptoId: string;
    ambientes: string | null;
    fecha: string;
    tipo: string;
  },
): MontoCongelado {
  const pagoDoble = esPagoDoble(criterio.fecha, criterio.tipo, feriados);
  const tarifa = resolverTarifa(tarifas, criterio);

  if (!tarifa) {
    return { monto_pactado: null, moneda: null, tarifa_id: null, pago_doble: pagoDoble };
  }

  const factor =
    (pagoDoble ? 2 : 1) * (TIPOS_MEDIA_PAGA.has(criterio.tipo) ? 0.5 : 1);

  return {
    monto_pactado: Math.round(tarifa.monto * factor * 100) / 100,
    moneda: tarifa.moneda,
    tarifa_id: tarifa.id,
    pago_doble: pagoDoble,
  };
}
