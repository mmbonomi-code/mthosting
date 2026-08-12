/**
 * Caja: saldo, conversión a dólares y reembolsos.
 *
 * El saldo NO se recorre fila por fila sobre toda la historia: eso es lo que
 * hace Ninox y CLAUDE.md lo nombra como el anti-ejemplo. Acá el saldo con el
 * que arranca un período viene de una sola agregación en la base
 * (`saldo_caja_antes`), y esta función solo va acumulando sobre los
 * movimientos que se están mirando en pantalla.
 *
 * Funciones puras, con tests.
 */

export type TipoMovimiento = "ingreso" | "egreso";

export type Movimiento = {
  id: string;
  fecha: string;
  tipo: TipoMovimiento;
  monto: number;
  moneda: string;
  /** Cotización congelada del día. `null` si todavía no se cargó. */
  tc: number | null;
  descripcion: string | null;
  categoria_id: string | null;
  categoria_nombre: string | null;
  depto_id: string | null;
  depto_codigo: string | null;
  reembolsable: boolean;
  fecha_cobro: string | null;
  forma_cobro: string | null;
};

export type MovimientoConSaldo = Movimiento & { saldo: number };

/** Lo que el movimiento le suma o le resta a la caja. */
export function signo(m: Pick<Movimiento, "tipo" | "monto">): number {
  return m.tipo === "ingreso" ? m.monto : -m.monto;
}

/**
 * Le pone a cada movimiento el saldo que deja la caja después de él.
 *
 * Los movimientos tienen que venir ordenados de más viejo a más nuevo, y
 * `saldoInicial` es lo que había antes del primero.
 */
export function acumular(
  movimientos: Movimiento[],
  saldoInicial: number,
): MovimientoConSaldo[] {
  let saldo = saldoInicial;
  return movimientos.map((m) => {
    saldo += signo(m);
    return { ...m, saldo };
  });
}

/** Ingresos menos egresos de una lista. No mira la historia anterior. */
export function resultado(movimientos: Movimiento[]): number {
  return movimientos.reduce((suma, m) => suma + signo(m), 0);
}

export function totalPorTipo(
  movimientos: Movimiento[],
  tipo: TipoMovimiento,
): number {
  return movimientos
    .filter((m) => m.tipo === tipo)
    .reduce((suma, m) => suma + m.monto, 0);
}

/**
 * El monto en dólares, con la cotización que quedó congelada el día del
 * movimiento. Sin cotización devuelve `null`: no se inventa un número.
 */
export function enDolares(m: Pick<Movimiento, "monto" | "tc">): number | null {
  if (m.tc === null || m.tc <= 0) return null;
  return Math.round((m.monto / m.tc) * 100) / 100;
}

// --- Reembolsos --------------------------------------------------------------

/** Un reembolsable sin fecha de cobro está pendiente. */
export function estaPendienteDeCobro(m: Movimiento): boolean {
  return m.reembolsable && m.fecha_cobro === null;
}

export type DeudaPorDepto = {
  depto_id: string;
  depto_codigo: string;
  cantidad: number;
  total: number;
  desde: string;
};

/**
 * Lo que deben los propietarios, agrupado por departamento, del que más debe
 * al que menos. Es como se cobra: por departamento, no de a un gasto.
 */
export function deudaPorDepartamento(movimientos: Movimiento[]): DeudaPorDepto[] {
  const porDepto = new Map<string, DeudaPorDepto>();

  for (const m of movimientos) {
    if (!estaPendienteDeCobro(m) || !m.depto_id) continue;

    const actual = porDepto.get(m.depto_id);
    if (actual) {
      actual.cantidad++;
      actual.total += m.monto;
      if (m.fecha < actual.desde) actual.desde = m.fecha;
    } else {
      porDepto.set(m.depto_id, {
        depto_id: m.depto_id,
        depto_codigo: m.depto_codigo ?? "Sin departamento",
        cantidad: 1,
        total: m.monto,
        desde: m.fecha,
      });
    }
  }

  return [...porDepto.values()].sort(
    (a, b) => b.total - a.total || a.depto_codigo.localeCompare(b.depto_codigo),
  );
}

// --- Filtros -----------------------------------------------------------------

export type FiltrosCaja = {
  q: string;
  tipo: TipoMovimiento | null;
  categoria: string;
  depto: string;
  /** Solo los reembolsables que todavía no se cobraron. */
  soloPorCobrar: boolean;
};

export function filtrar(movimientos: Movimiento[], f: FiltrosCaja): Movimiento[] {
  const termino = f.q.trim().toLowerCase();

  return movimientos.filter((m) => {
    if (f.soloPorCobrar && !estaPendienteDeCobro(m)) return false;
    if (f.tipo !== null && m.tipo !== f.tipo) return false;
    if (f.categoria !== "" && m.categoria_id !== f.categoria) return false;
    if (f.depto !== "" && m.depto_id !== f.depto) return false;
    if (termino === "") return true;
    return [m.descripcion, m.categoria_nombre, m.depto_codigo]
      .filter(Boolean)
      .some((campo) => campo!.toLowerCase().includes(termino));
  });
}

// --- Presentación ------------------------------------------------------------

/** `1716000` → `$ 1.716.000`. Los pesos van sin centavos: no se usan. */
export function pesos(monto: number): string {
  const signoTexto = monto < 0 ? "-" : "";
  return `${signoTexto}$ ${Math.abs(Math.round(monto)).toLocaleString("es-AR")}`;
}

export function dolares(monto: number | null): string {
  if (monto === null) return "—";
  return `US$ ${monto.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
