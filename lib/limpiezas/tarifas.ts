/**
 * Resolución de la tarifa de una limpieza (spec §1.1 y §3.2).
 *
 * Al asignar una limpieza se congela el monto: se resuelve la tarifa vigente
 * A ESA FECHA, se calcula el pago doble (domingo o feriado) y el resultado se
 * guarda en `monto_pactado`. Nunca se recalcula después: cargar tarifas
 * nuevas no altera lo ya asignado.
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

/** Domingo o feriado: la limpieza se paga doble. */
export function esPagoDoble(fecha: string, feriados: ReadonlySet<string>): boolean {
  if (feriados.has(fecha)) return true;
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay() === 0;
}

/**
 * Busca la tarifa que corresponde. Una tarifa puntual del departamento le
 * gana a la general por ambientes. Si no hay ninguna vigente, devuelve null:
 * la limpieza se asigna igual, sin monto.
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
 * El monto que se congela al asignar. Con pago doble ya viene duplicado:
 * es lo que la persona va a cobrar por esa limpieza.
 */
export function congelarMonto(
  tarifas: Tarifa[],
  feriados: ReadonlySet<string>,
  criterio: { deptoId: string; ambientes: string | null; fecha: string },
): MontoCongelado {
  const pagoDoble = esPagoDoble(criterio.fecha, feriados);
  const tarifa = resolverTarifa(tarifas, criterio);

  if (!tarifa) {
    return { monto_pactado: null, moneda: null, tarifa_id: null, pago_doble: pagoDoble };
  }

  return {
    monto_pactado: pagoDoble ? tarifa.monto * 2 : tarifa.monto,
    moneda: tarifa.moneda,
    tarifa_id: tarifa.id,
    pago_doble: pagoDoble,
  };
}
