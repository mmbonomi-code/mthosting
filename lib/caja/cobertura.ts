/**
 * Qué bolsa pagó cada gasto (decisiones del dueño, 12/08/2026).
 *
 * La plata entra en su mayoría cambiando dólares: cada cambio es una BOLSA de
 * pesos con un costo conocido en dólares. Los gastos van consumiendo bolsas
 * en orden de llegada, y un gasto se valúa por las bolsas que consumió, no
 * por el dólar del día. Si un gasto se come el final de una bolsa y el
 * principio de la siguiente, se parte entre las dos.
 *
 * Las tres reglas acordadas:
 *
 *   1. Un ingreso de una categoría de cambio arma una bolsa con SU tipo de
 *      cambio.
 *   2. Un ingreso que no es un cambio —una devolución de propietario, una
 *      diferencia de caja— también arma bolsa, pero sin costo en dólares: los
 *      gastos que la consuman se valúan al dólar del día en que se hicieron.
 *   3. Si un día se gastó más de lo que había, lo descubierto lo cubre el
 *      CAMBIO SIGUIENTE. Pasa cuando el cambio se registró un día tarde.
 *
 * Funciones puras, con tests.
 */

export type MovimientoParaReparto = {
  id: string;
  fecha: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  /** Tipo de cambio de la bolsa. Solo en los ingresos que son cambio. */
  tc_cambio: number | null;
};

/** Un tramo de un gasto, pagado por una bolsa. */
export type Cobertura = {
  movimiento_id: string;
  /** El ingreso que lo cubre. `null` si todavía quedó descubierto. */
  origen_id: string | null;
  monto: number;
  /** El tipo de cambio de esa bolsa. `null` = se valúa al dólar del día. */
  tc: number | null;
};

type Bolsa = { id: string; tc: number | null; restante: number };
type Pendiente = { movimiento_id: string; restante: number };

/**
 * El orden en que la caja consume la plata.
 *
 * Dentro de un mismo día los ingresos van primero: el archivo de Ninox tiene
 * las filas en el orden en que se anotaron, no en el que ocurrieron, y
 * tomarlo literal deja la caja en descubierto por millones. Con los ingresos
 * primero, el día cierra como cerró de verdad.
 */
export function ordenarParaReparto(
  movimientos: MovimientoParaReparto[],
): MovimientoParaReparto[] {
  return [...movimientos].sort(
    (a, b) =>
      a.fecha.localeCompare(b.fecha) ||
      (a.tipo === b.tipo ? 0 : a.tipo === "ingreso" ? -1 : 1),
  );
}

/**
 * Reparte cada gasto entre las bolsas que lo pagaron.
 *
 * Devuelve un tramo por cada (gasto, bolsa). Un gasto cubierto por dos
 * bolsas devuelve dos tramos; uno que quedó descubierto devuelve un tramo con
 * `origen_id` en null.
 */
export function repartirCobertura(
  movimientos: MovimientoParaReparto[],
): Cobertura[] {
  const orden = ordenarParaReparto(movimientos);
  const bolsas: Bolsa[] = [];
  const pendientes: Pendiente[] = [];
  const coberturas: Cobertura[] = [];

  /** Saca plata de las bolsas más viejas hasta juntar el monto pedido. */
  const consumir = (movimiento_id: string, pedido: number): number => {
    let restante = pedido;
    for (const bolsa of bolsas) {
      if (restante <= 0) break;
      if (bolsa.restante <= 0) continue;
      const usar = Math.min(restante, bolsa.restante);
      coberturas.push({ movimiento_id, origen_id: bolsa.id, monto: usar, tc: bolsa.tc });
      bolsa.restante -= usar;
      restante -= usar;
    }
    return restante;
  };

  for (const m of orden) {
    if (m.tipo === "ingreso") {
      const bolsa: Bolsa = { id: m.id, tc: m.tc_cambio, restante: m.monto };
      bolsas.push(bolsa);

      // Regla 3: lo que había quedado descubierto lo cubre este ingreso,
      // antes que cualquier gasto posterior.
      while (pendientes.length > 0 && bolsa.restante > 0) {
        const p = pendientes[0];
        const usar = Math.min(p.restante, bolsa.restante);
        coberturas.push({
          movimiento_id: p.movimiento_id,
          origen_id: bolsa.id,
          monto: usar,
          tc: bolsa.tc,
        });
        p.restante -= usar;
        bolsa.restante -= usar;
        if (p.restante <= 0) pendientes.shift();
      }
      continue;
    }

    const descubierto = consumir(m.id, m.monto);
    if (descubierto > 0) {
      pendientes.push({ movimiento_id: m.id, restante: descubierto });
    }
  }

  // Lo que nunca llegó a cubrirse queda anotado como tal: no se esconde.
  for (const p of pendientes) {
    coberturas.push({
      movimiento_id: p.movimiento_id,
      origen_id: null,
      monto: p.restante,
      tc: null,
    });
  }

  return coberturas;
}

/**
 * El costo en dólares de un gasto, sumando sus tramos.
 *
 * `tcDelDia` es el dólar del día del gasto, que se usa para los tramos que no
 * vinieron de un cambio. Si hace falta y no está cargado, devuelve `null`:
 * no se inventa un número.
 */
export function costoEnDolares(
  tramos: Cobertura[],
  tcDelDia: number | null,
): number | null {
  let total = 0;

  for (const t of tramos) {
    const tc = t.tc ?? tcDelDia;
    if (tc === null || tc <= 0) return null;
    total += t.monto / tc;
  }

  return Math.round(total * 100) / 100;
}

/** El tipo de cambio promedio que terminó pagando un gasto. */
export function tcPromedio(tramos: Cobertura[], tcDelDia: number | null): number | null {
  const pesos = tramos.reduce((s, t) => s + t.monto, 0);
  const usd = costoEnDolares(tramos, tcDelDia);
  if (usd === null || usd === 0) return null;
  return Math.round((pesos / usd) * 100) / 100;
}

/** ¿Quedó algún tramo sin bolsa que lo cubra? */
export function tieneDescubierto(tramos: Cobertura[]): boolean {
  return tramos.some((t) => t.origen_id === null);
}

/** Los pesos de un cambio que todavía no gastó nadie. */
export function saldoDeBolsa(
  cambioId: string,
  monto: number,
  coberturas: Cobertura[],
): number {
  const usado = coberturas
    .filter((c) => c.origen_id === cambioId)
    .reduce((s, c) => s + c.monto, 0);
  return Math.round((monto - usado) * 100) / 100;
}
