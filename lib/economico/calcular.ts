/**
 * El motor de cálculo del módulo económico (spec §5).
 *
 * Traduce cada movimiento importado a lo que aporta a tres cifras:
 *
 *   GANANCIA  — lo que MTHosting DEBERÍA ganar. Es la comisión ordinaria del
 *               departamento, siempre. Define la rentabilidad.
 *   PERCIBIDO — lo que realmente ENTRÓ. Es control de cobranza, no de
 *               rentabilidad: puede estar muy por encima o por debajo.
 *   AIRCOVER  — indemnizaciones por daños. Se informan aparte y no entran a
 *               ninguna de las dos (decisión de Marcos, 15/08/2026).
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

export type Aporte = {
  ganancia: number;
  percibido: number;
  aircover: number;
  /** Plata del propietario que pasó por una cuenta MTH. Insumo de la etapa 2. */
  custodia: number;
};

const CERO: Aporte = { ganancia: 0, percibido: 0, aircover: 0, custodia: 0 };

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
    // La limpieza va 100% a MTHosting y no comisiona.
    return { ...CERO, ganancia: (monto - limpieza) * pct + limpieza };
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
    // A cuenta del propietario: no es plata de MTHosting en ningún sentido.
    if (m.clase_cuenta !== "mth") return { ...CERO };
    // A cuenta MTH pero con coanfitrión en el grupo: la comisión ya entró por
    // ese canal, así que esto es plata del propietario en tránsito.
    if (m.grupo_con_coanfitrion) return { ...CERO, custodia: cobrado };
    return { ...CERO, percibido: cobrado };
  }

  if (EXTRA.has(m.categoria)) {
    const monto = aUsd(Number(m.monto ?? 0), m.moneda, m.tc_usd);
    if (monto === null) return null;
    return { ...CERO, ganancia: monto * pct };
  }

  return { ...CERO };
}

export type Celda = Aporte & {
  depto_id: string;
  /** `2026-04`. */
  mes: string;
  reservas: number;
};

export type FilaAgregable = MovimientoCalculable & {
  depto_id: string | null;
  fecha: string;
};

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
      { depto_id: f.depto_id, mes, reservas: 0, ...CERO };
    c.ganancia += aporte.ganancia;
    c.percibido += aporte.percibido;
    c.aircover += aporte.aircover;
    c.custodia += aporte.custodia;
    if (f.categoria === "reserva") c.reservas++;
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

/** La brecha: percibido − ganancia. Positiva no es error, puede ser recupero. */
export const brecha = (c: Aporte): number => c.percibido - c.ganancia;
