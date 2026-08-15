/**
 * El motor de cálculo del módulo económico (spec §5).
 *
 * Traduce cada movimiento importado a lo que aporta a tres cifras:
 *
 *   GANANCIA  — lo que MTHosting DEBERÍA ganar. Es la comisión ordinaria del
 *               departamento, siempre. Define la rentabilidad.
 *   PERCIBIDO — todo lo que ENTRÓ a MTHosting, por el canal que sea: la línea
 *               de coanfitrión y los payout que fueron a una cuenta propia.
 *               No es rentabilidad y no pretende serlo.
 *   AIRCOVER  — indemnizaciones por daños. Se informan aparte y no entran a
 *               ninguna de las dos (decisión de Marcos, 15/08/2026).
 *
 * LA BRECHA (percibido − ganancia) ES EL SALDO CON EL PROPIETARIO, no un
 * error de conciliación (decisión de Marcos, 15/08/2026). Positiva: entró más
 * de lo que corresponde y MTHosting le debe. Negativa: le deben a MTHosting.
 * Por eso el percibido incluye la plata del propietario que pasó por una
 * cuenta de MTHosting: sacarla haría desaparecer justamente la deuda.
 *
 * LA REGLA QUE NO SE PUEDE ROMPER: la ganancia NUNCA se calcula sobre lo
 * cobrado. Cuando MTHosting cobra de más es recupero de gastos que puso, no
 * una comisión mayor. KENNEDY 1 en junio 2026 es el caso testigo: entró el
 * doble de plata y la ganancia no se movió. Calcular la ganancia sobre el
 * percibido convertiría a un departamento con un propietario deudor en el más
 * rentable de la cartera.
 *
 * Funciones puras: no tocan la base, no saben qué día es hoy, no redondean.
 * El redondeo va SOLO en la presentación (spec §5.1): redondear cada
 * movimiento antes de sumarlo desvía uno o dos centavos por mes contra la
 * planilla de control.
 */

export type Categoria =
  | "reserva"
  | "coanfitrion"
  | "payout"
  | "resolucion"
  | "ajuste"
  | "ajuste_resolucion"
  | "tarifa_cancelacion"
  | "reembolso_tarifa_cancelacion"
  | "aircover"
  | "otro";

/** Cómo quedó clasificada la cuenta a la que fue un payout. */
export type ClaseCuenta = "mth" | "propietario" | "sin_clasificar";

export type MovimientoCalculable = {
  categoria: Categoria;
  /** Signo incluido. Las líneas de coanfitrión son negativas. */
  monto: number | null;
  /** En los Payout el importe viene acá y `monto` está vacío. */
  cobrado: number | null;
  tarifa_limpieza: number | null;
  moneda: string;
  /** Solo en los payout. */
  clase_cuenta?: ClaseCuenta;
  /**
   * Si el grupo del payout trae línea de coanfitrión, la comisión ya se cobró
   * por ese canal y el payout es plata del propietario que MTHosting cobra y
   * después gira: custodia, no ingreso propio.
   */
  grupo_con_coanfitrion?: boolean;
  /**
   * Para convertir a dólares lo que no vino en dólares. Nulo cuando la fila ya
   * está en USD.
   */
  tc_usd?: number | null;
};

/**
 * La ganancia se guarda ABIERTA en sus dos mitades, no como un total.
 *
 * Son negocios distintos y se mueven distinto: la comisión depende de cuánto
 * factura el departamento, la limpieza depende de cuántas veces se ocupó. Un
 * mes con muchas estadías cortas sube la limpieza sin mover la comisión, y eso
 * no se ve si el número viene sumado.
 *
 * `ganancia()` las suma cuando hace falta. No se guarda el total además de las
 * partes: dos fuentes para el mismo número siempre terminan discrepando.
 */
export type Aporte = {
  /** El porcentaje sobre el alquiler. */
  comision: number;
  /** La tarifa de limpieza, que va 100% a MTHosting y no comisiona. */
  limpieza: number;
  percibido: number;
  aircover: number;
  /**
   * Cuánto del percibido entró por un payout a cuenta MTH cuyo grupo traía
   * línea de coanfitrión, o sea plata que en el fondo es del propietario.
   * Es INFORMATIVO: ya está adentro de `percibido`, no se resta. Sirve para
   * la cuenta corriente con propietarios de la etapa 2.
   */
  custodia: number;
};

export const ganancia = (a: Pick<Aporte, "comision" | "limpieza">): number =>
  a.comision + a.limpieza;

const CERO: Aporte = {
  comision: 0,
  limpieza: 0,
  percibido: 0,
  aircover: 0,
  custodia: 0,
};

/** Las categorías que se comisionan sin descontar limpieza (spec §5.1). */
const EXTRA: ReadonlySet<Categoria> = new Set([
  "resolucion",
  "ajuste",
  "ajuste_resolucion",
  "tarifa_cancelacion",
  "reembolso_tarifa_cancelacion",
  "otro",
]);

/** A dólares. Una fila sin tipo de cambio y sin ser USD no se puede sumar. */
function aUsd(monto: number, moneda: string, tc: number | null | undefined): number | null {
  if (moneda === "USD") return monto;
  if (!tc) return null;
  return monto / tc;
}

/**
 * Qué aporta UN movimiento. `pctComision` es el porcentaje del departamento
 * (20 para el 20%), no una fracción.
 *
 * Devuelve null cuando la fila no se puede convertir a dólares: no se inventa
 * un tipo de cambio, se avisa. El que llama la lista aparte.
 */
export function aporteDeMovimiento(
  m: MovimientoCalculable,
  pctComision: number,
): Aporte | null {
  const pct = pctComision / 100;

  if (m.categoria === "aircover") {
    const usd = aUsd(Number(m.monto ?? 0), m.moneda, m.tc_usd);
    return usd === null ? null : { ...CERO, aircover: usd };
  }

  if (m.categoria === "reserva") {
    const monto = aUsd(Number(m.monto ?? 0), m.moneda, m.tc_usd);
    const limpieza = aUsd(Number(m.tarifa_limpieza ?? 0), m.moneda, m.tc_usd);
    if (monto === null || limpieza === null) return null;
    // La limpieza va 100% a MTHosting y no comisiona: se descuenta del monto
    // antes de aplicar el porcentaje y después se suma entera.
    return { ...CERO, comision: (monto - limpieza) * pct, limpieza };
  }

  if (m.categoria === "coanfitrion") {
    const monto = aUsd(Number(m.monto ?? 0), m.moneda, m.tc_usd);
    if (monto === null) return null;
    // Signo invertido sobre la SUMA, nunca abs() fila por fila: existen líneas
    // positivas, que son devoluciones de comisión al ajustar una reserva.
    return { ...CERO, percibido: -monto };
  }

  if (m.categoria === "payout") {
    const cobrado = aUsd(Number(m.cobrado ?? 0), m.moneda, m.tc_usd);
    if (cobrado === null) return null;
    // A cuenta del propietario: no pasó por MTHosting, no entró.
    if (m.clase_cuenta !== "mth") return { ...CERO };
    // A cuenta de MTHosting: ENTRÓ, y por eso es percibido (decisión de
    // Marcos, 15/08/2026). Que una parte sea del propietario no cambia que
    // haya entrado; eso lo dice la brecha contra la ganancia, que bajo este
    // criterio ES el saldo con el propietario: si percibido supera a la
    // ganancia, MTHosting le debe; si queda por debajo, le deben.
    //
    // No hay doble conteo con la línea de coanfitrión del mismo grupo: el
    // payout ya viene NETO de lo derivado al coanfitrión. Los dos juntos dan
    // el bruto de la reserva, una sola vez.
    //
    // `custodia` se sigue midiendo, pero solo como informativo: cuánto de lo
    // que entró era plata de un propietario. No se resta de percibido.
    return {
      ...CERO,
      percibido: cobrado,
      custodia: m.grupo_con_coanfitrion ? cobrado : 0,
    };
  }

  if (EXTRA.has(m.categoria)) {
    const monto = aUsd(Number(m.monto ?? 0), m.moneda, m.tc_usd);
    if (monto === null) return null;
    // Sin limpieza: un cobro de resolución o un ajuste comisiona pelado.
    return { ...CERO, comision: monto * pct };
  }

  return { ...CERO };
}

export type Celda = Aporte & {
  depto_id: string;
  /** `2026-04`. */
  mes: string;
  reservas: number;
  noches: number;
};

export type FilaAgregable = MovimientoCalculable & {
  depto_id: string | null;
  fecha: string;
  noches?: number | null;
};

/** Suma un conjunto de celdas. Para totales por mes, por depto o generales. */
export function totalizar(celdas: Aporte[]): Aporte {
  const t = { ...CERO };
  for (const c of celdas) {
    t.comision += c.comision;
    t.limpieza += c.limpieza;
    t.percibido += c.percibido;
    t.aircover += c.aircover;
    t.custodia += c.custodia;
  }
  return t;
}

export type ResultadoAgregado = {
  celdas: Celda[];
  /** Filas que no se pudieron sumar, para que no desaparezcan en silencio. */
  sinConvertir: number;
  /** Filas sin departamento: el anuncio todavía no está mapeado. */
  sinDepartamento: number;
};

/**
 * Departamento × mes, que es la vista principal (spec §6.2).
 *
 * Una sola pasada sobre las filas, sin recorrer la tabla por cada
 * departamento: la escala es chica pero el patrón O(n²) está prohibido
 * (CLAUDE.md) y acá no cuesta nada evitarlo.
 */
export function agregarPorDeptoMes(
  filas: FilaAgregable[],
  comisionPorDepto: Map<string, number>,
): ResultadoAgregado {
  const celdas = new Map<string, Celda>();
  let sinConvertir = 0;
  let sinDepartamento = 0;

  for (const f of filas) {
    if (!f.depto_id) {
      sinDepartamento++;
      continue;
    }
    const aporte = aporteDeMovimiento(f, comisionPorDepto.get(f.depto_id) ?? 20);
    if (aporte === null) {
      sinConvertir++;
      continue;
    }
    const mes = f.fecha.slice(0, 7);
    const clave = `${f.depto_id}|${mes}`;
    const c =
      celdas.get(clave) ??
      { depto_id: f.depto_id, mes, reservas: 0, noches: 0, ...CERO };
    c.comision += aporte.comision;
    c.limpieza += aporte.limpieza;
    c.percibido += aporte.percibido;
    c.aircover += aporte.aircover;
    c.custodia += aporte.custodia;
    if (f.categoria === "reserva") {
      c.reservas++;
      c.noches += f.noches ?? 0;
    }
    celdas.set(clave, c);
  }

  return {
    celdas: [...celdas.values()].sort(
      (a, b) => a.depto_id.localeCompare(b.depto_id) || a.mes.localeCompare(b.mes),
    ),
    sinConvertir,
    sinDepartamento,
  };
}

/**
 * El saldo con el propietario: percibido − ganancia.
 *
 * Positivo, MTHosting cobró más de lo que le corresponde y le DEBE al
 * propietario. Negativo, entró menos de lo ganado y el propietario le debe a
 * MTHosting. Nunca es "un error a corregir".
 */
export const saldoPropietario = (c: Aporte): number => c.percibido - ganancia(c);
