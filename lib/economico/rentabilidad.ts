/**
 * Ganancia contra gastos, mes a mes, en dólares y en pesos (Marcos, 18/08/2026).
 *
 * Las dos puntas nacen en monedas distintas y eso es a propósito, no un
 * defecto a corregir:
 *
 *   - La GANANCIA nace en USD: sale del motor económico (`calcular.ts`), que
 *     ya reporta en dólares.
 *   - Los GASTOS nacen en ARS: salen de la Caja, que es en pesos.
 *
 * Para poder compararlos en la misma moneda hace falta un tipo de cambio en
 * los dos sentidos:
 *
 *   - Gastos → USD: cada movimiento de Caja ya tiene su propio TC congelado
 *     el día que se cargó (`enDolares`, de `lib/caja/saldo.ts`). Se suma fila
 *     por fila con SU tipo de cambio, no con uno global del mes.
 *   - Ganancia → ARS: acá no hay un TC por fila, así que se usa un
 *     representativo del mes: la MEDIANA de las cotizaciones que Marcos cargó
 *     ese mes en Caja (no el promedio, para que un solo día disparatado no
 *     corra el número — mismo criterio que en `validar.ts` para los grupos de
 *     payout en otra moneda).
 *
 * Los gastos que reembolsa el propietario NO son un costo real de MTHosting
 * —es plata que se adelanta y se recupera—, así que se excluyen siempre,
 * hayan sido cobrados o no (decisión de Marcos, 18/08/2026).
 *
 * Funciones puras, con tests.
 */

import { enDolares } from "../caja/saldo";

export type GastoCaja = {
  fecha: string;
  /** ARS, siempre positivo: así se guarda un movimiento de Caja. */
  monto: number;
  /** Cotización congelada el día que se cargó. Null si todavía no se cargó. */
  tc: number | null;
  tipo: "ingreso" | "egreso";
  reembolsable: boolean;
  activo: boolean;
};

export type MesRentabilidad = {
  mes: string;
  gananciaUsd: number;
  /** Null si ese mes no tiene ninguna cotización cargada. */
  gananciaArs: number | null;
  gastosArs: number;
  gastosUsd: number;
  /** Gastos de ese mes que no se pudieron convertir: faltan para completar el número en USD. */
  gastosSinConvertir: number;
  resultadoUsd: number;
  resultadoArs: number | null;
};

/** Es un gasto real de la operación: ni un ingreso, ni de baja, ni algo que el propietario devuelve. */
export function esGastoReal(
  g: Pick<GastoCaja, "activo" | "tipo" | "reembolsable">,
): boolean {
  return g.activo && g.tipo === "egreso" && !g.reembolsable;
}

/** La mediana. Un solo valor fuera de línea no debe correr el representativo. */
export function medianaDe(numeros: number[]): number | null {
  if (numeros.length === 0) return null;
  const ordenados = [...numeros].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)];
}

/** El tipo de cambio típico de cada mes, a partir de las cotizaciones cargadas. */
export function tcRepresentativoPorMes(
  cotizaciones: { fecha: string; tc: number }[],
): Map<string, number> {
  const porMes = new Map<string, number[]>();
  for (const c of cotizaciones) {
    const mes = c.fecha.slice(0, 7);
    porMes.set(mes, [...(porMes.get(mes) ?? []), c.tc]);
  }
  const salida = new Map<string, number>();
  for (const [mes, tcs] of porMes) {
    const mediana = medianaDe(tcs);
    if (mediana !== null) salida.set(mes, mediana);
  }
  return salida;
}

/**
 * Arma la tabla mes a mes. `gananciaPorMesUsd` ya viene calculada por el
 * motor económico: esta función no sabe nada de comisiones ni de reservas,
 * solo combina tres números por mes.
 */
export function calcularRentabilidad(
  gananciaPorMesUsd: Map<string, number>,
  gastos: GastoCaja[],
  cotizaciones: { fecha: string; tc: number }[],
  desde: string,
): MesRentabilidad[] {
  const tcPorMes = tcRepresentativoPorMes(cotizaciones);

  const gastosPorMes = new Map<
    string,
    { ars: number; usd: number; sinConvertir: number }
  >();
  for (const g of gastos) {
    if (!esGastoReal(g)) continue;
    const mes = g.fecha.slice(0, 7);
    const acc = gastosPorMes.get(mes) ?? { ars: 0, usd: 0, sinConvertir: 0 };
    acc.ars += g.monto;
    const usd = enDolares(g);
    if (usd !== null) acc.usd += usd;
    else acc.sinConvertir++;
    gastosPorMes.set(mes, acc);
  }

  const meses = new Set([...gananciaPorMesUsd.keys(), ...gastosPorMes.keys()]);

  const filas: MesRentabilidad[] = [];
  for (const mes of meses) {
    if (mes < desde) continue;
    const gananciaUsd = gananciaPorMesUsd.get(mes) ?? 0;
    const g = gastosPorMes.get(mes) ?? { ars: 0, usd: 0, sinConvertir: 0 };
    const tcMes = tcPorMes.get(mes) ?? null;
    const gananciaArs = tcMes === null ? null : gananciaUsd * tcMes;

    filas.push({
      mes,
      gananciaUsd,
      gananciaArs,
      gastosArs: g.ars,
      gastosUsd: g.usd,
      gastosSinConvertir: g.sinConvertir,
      resultadoUsd: gananciaUsd - g.usd,
      resultadoArs: gananciaArs === null ? null : gananciaArs - g.ars,
    });
  }

  return filas.sort((a, b) => a.mes.localeCompare(b.mes));
}
