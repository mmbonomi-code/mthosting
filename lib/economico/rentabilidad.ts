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
 *   - Gastos → USD: fila por fila, nunca con un tipo de cambio global del
 *     mes. Hay dos criterios y se puede elegir con cuál mirar la tabla
 *     (pedido de Marcos, 09/09/2026):
 *
 *       BOLSAS (el que manda) — el gasto se valúa por los cambios de moneda
 *       que lo pagaron, o sea el costo real de esa plata. Es el mismo número
 *       que muestra la ficha del movimiento en Caja, así que las dos
 *       pantallas dejan de decir cosas distintas.
 *
 *       DÍA — el gasto se valúa a la cotización cargada para su fecha.
 *
 *     Con los datos de 2026 los dos dan casi lo mismo, porque la cotización
 *     del día sale de esos mismos cambios. Se dejan los dos porque un cambio
 *     hecho a un dólar distinto del cargado separa las cifras, y ahí conviene
 *     poder ver las dos.
 *
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
import { costoEnDolares, type Cobertura } from "../caja/cobertura";

/** Con qué dólar se valúa un gasto. */
export type CriterioCosto = "bolsas" | "dia";

export type GastoCaja = {
  fecha: string;
  /** ARS, siempre positivo: así se guarda un movimiento de Caja. */
  monto: number;
  /** Cotización congelada el día que se cargó. Null si todavía no se cargó. */
  tc: number | null;
  tipo: "ingreso" | "egreso";
  reembolsable: boolean;
  activo: boolean;
  /**
   * Los tramos de cambio que pagaron este gasto. Vacío mientras el reparto no
   * esté hecho: ahí el criterio de bolsas no se puede aplicar y el gasto se
   * valúa al dólar del día, en vez de inventarle un costo.
   */
  tramos?: Cobertura[];
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
  /**
   * Gastos que se pidieron por bolsas y no tienen reparto: se valuaron al
   * dólar del día. Siempre 0 con el criterio del día.
   */
  gastosSinReparto: number;
  resultadoUsd: number;
  resultadoArs: number | null;
};

/** Es un gasto real de la operación: ni un ingreso, ni de baja, ni algo que el propietario devuelve. */
export function esGastoReal(
  g: Pick<GastoCaja, "activo" | "tipo" | "reembolsable">,
): boolean {
  return g.activo && g.tipo === "egreso" && !g.reembolsable;
}

/**
 * ¿Los tramos cubren el gasto entero?
 *
 * Un reparto a medias no sirve para valuar: si el gasto se cargó después del
 * último recálculo, o si quedó un tramo colgado, la suma de los tramos no
 * llega al monto y el costo por bolsas saldría corto. Se prefiere caer al
 * dólar del día y avisar, antes que mostrar un número que no cierra.
 */
export function tieneRepartoCompleto(g: GastoCaja): boolean {
  if (!g.tramos || g.tramos.length === 0) return false;
  const cubierto = g.tramos.reduce((suma, t) => suma + t.monto, 0);
  return Math.abs(cubierto - g.monto) < 0.01;
}

/**
 * El costo en dólares de un gasto, según el criterio pedido.
 *
 * Devuelve `null` cuando no hay con qué convertirlo: no se inventa un tipo de
 * cambio. Con `bolsas`, un gasto sin reparto completo se valúa al dólar del
 * día (`tieneRepartoCompleto` dice cuáles son, para poder contarlos).
 */
export function costoDelGasto(g: GastoCaja, criterio: CriterioCosto): number | null {
  if (criterio === "dia" || !tieneRepartoCompleto(g)) return enDolares(g);
  return costoEnDolares(g.tramos!, g.tc);
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
  criterio: CriterioCosto,
): MesRentabilidad[] {
  const tcPorMes = tcRepresentativoPorMes(cotizaciones);

  const gastosPorMes = new Map<
    string,
    { ars: number; usd: number; sinConvertir: number; sinReparto: number }
  >();
  for (const g of gastos) {
    if (!esGastoReal(g)) continue;
    const mes = g.fecha.slice(0, 7);
    const acc =
      gastosPorMes.get(mes) ?? { ars: 0, usd: 0, sinConvertir: 0, sinReparto: 0 };
    acc.ars += g.monto;
    if (criterio === "bolsas" && !tieneRepartoCompleto(g)) acc.sinReparto++;
    const usd = costoDelGasto(g, criterio);
    if (usd !== null) acc.usd += usd;
    else acc.sinConvertir++;
    gastosPorMes.set(mes, acc);
  }

  const meses = new Set([...gananciaPorMesUsd.keys(), ...gastosPorMes.keys()]);

  const filas: MesRentabilidad[] = [];
  for (const mes of meses) {
    if (mes < desde) continue;
    const gananciaUsd = gananciaPorMesUsd.get(mes) ?? 0;
    const g =
      gastosPorMes.get(mes) ?? { ars: 0, usd: 0, sinConvertir: 0, sinReparto: 0 };
    const tcMes = tcPorMes.get(mes) ?? null;
    const gananciaArs = tcMes === null ? null : gananciaUsd * tcMes;

    filas.push({
      mes,
      gananciaUsd,
      gananciaArs,
      gastosArs: g.ars,
      gastosUsd: g.usd,
      gastosSinConvertir: g.sinConvertir,
      gastosSinReparto: g.sinReparto,
      resultadoUsd: gananciaUsd - g.usd,
      resultadoArs: gananciaArs === null ? null : gananciaArs - g.ars,
    });
  }

  return filas.sort((a, b) => a.mes.localeCompare(b.mes));
}
