/**
 * Ocupación de los departamentos (spec §3.10).
 *
 * Cada noche de cada departamento cae en uno de tres estados:
 *   - OCUPADA:   hay una reserva viva que la cubre.
 *   - BLOQUEADA: nadie la ocupó pero estaba cerrada al público (bloqueo del
 *                calendario de Airbnb, uso del propietario, mantenimiento).
 *   - LIBRE:     estaba a la venta y no se vendió.
 *
 * Los tres se informan por separado, no se descuentan del total (decisión del
 * dueño, 09/08/2026): saber cuánto se bloquea es tan importante como saber
 * cuánto se ocupa, y una ocupación "corregida" esconde justamente eso.
 *
 * Se cuentan NOCHES, no días. Una reserva del 10 al 12 son 2 noches: la del
 * 10 y la del 11. El día de check-out no es una noche. Los bloqueos usan la
 * misma convención, porque vienen del mismo calendario.
 *
 * Se marcan noches, no se suman duraciones: si dos reservas se pisan —pasa,
 * hay 3 casos en la base— la noche compartida se cuenta una sola vez y la
 * ocupación nunca puede pasar del 100%.
 *
 * Funciones puras, con tests: no tocan la base.
 */

/** Rango de fechas. `hasta` es EXCLUSIVO, igual que un check-out. */
export type Periodo = { desde: string; hasta: string };

export type ReservaOcupacion = {
  depto_id: string;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  cancelada: boolean;
};

export type BloqueoOcupacion = {
  depto_id: string;
  fecha_desde: string;
  fecha_hasta: string;
};

export type OcupacionDepto = {
  depto_id: string;
  noches_totales: number;
  noches_ocupadas: number;
  noches_bloqueadas: number;
  noches_libres: number;
  pct_ocupado: number;
  pct_bloqueado: number;
  /** Se calcula de las noches, no por resta: si no, los decimales no cierran. */
  pct_libre: number;
  /** Reservas vivas que EMPIEZAN en el período. */
  reservas: number;
  /** Promedio de noches de esas reservas, sin recortar por el período. */
  estadia_promedio: number | null;
  canceladas: number;
  /** Canceladas sobre el total de reservas que empezaban en el período. */
  pct_cancelacion: number | null;
};

// El calendario arranca en 0 (libre) y solo sube: un estado mayor pisa al
// menor, así una noche ocupada y bloqueada a la vez cuenta como ocupada.
const BLOQUEADA = 1;
const OCUPADA = 2;

/** Días transcurridos desde una fecha ancla. Solo sirve para restar. */
function aDia(fecha: string): number {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return Date.UTC(anio, mes - 1, dia) / 86_400_000;
}

/** Cuántas noches tiene el período. */
export function nochesDelPeriodo(periodo: Periodo): number {
  return Math.max(0, aDia(periodo.hasta) - aDia(periodo.desde));
}

/**
 * Marca las noches de un tramo dentro del período. `hasta` es exclusivo.
 * Un estado más alto pisa a uno más bajo: si una noche está ocupada y además
 * bloqueada, cuenta como ocupada.
 */
function marcar(
  noches: Uint8Array,
  inicioPeriodo: number,
  desde: string,
  hasta: string,
  estado: number,
): void {
  const a = Math.max(aDia(desde) - inicioPeriodo, 0);
  const b = Math.min(aDia(hasta) - inicioPeriodo, noches.length);
  for (let i = a; i < b; i++) {
    if (noches[i] < estado) noches[i] = estado;
  }
}

/**
 * Ocupación de cada departamento en el período.
 *
 * `deptos` define el universo: un departamento sin ninguna reserva figura
 * igual, con 0%. Es el dato importante, no un hueco.
 */
export function ocupacionPorDepto(
  deptos: string[],
  reservas: ReservaOcupacion[],
  bloqueos: BloqueoOcupacion[],
  periodo: Periodo,
): OcupacionDepto[] {
  const total = nochesDelPeriodo(periodo);
  const inicio = aDia(periodo.desde);

  const calendarios = new Map<string, Uint8Array>();
  for (const id of deptos) calendarios.set(id, new Uint8Array(total));

  for (const b of bloqueos) {
    const cal = calendarios.get(b.depto_id);
    if (cal) marcar(cal, inicio, b.fecha_desde, b.fecha_hasta, BLOQUEADA);
  }

  // Las canceladas no ocupan nada: la noche vuelve a estar libre.
  for (const r of reservas) {
    if (r.cancelada || !r.fecha_checkin || !r.fecha_checkout) continue;
    const cal = calendarios.get(r.depto_id);
    if (cal) marcar(cal, inicio, r.fecha_checkin, r.fecha_checkout, OCUPADA);
  }

  return deptos.map((id) => {
    const cal = calendarios.get(id)!;
    let ocupadas = 0;
    let bloqueadas = 0;
    for (const estado of cal) {
      if (estado === OCUPADA) ocupadas++;
      else if (estado === BLOQUEADA) bloqueadas++;
    }

    // Estadía y cancelación se miden sobre las reservas que EMPIEZAN en el
    // período: una estadía es de quien la reservó, no se parte por mes.
    const delPeriodo = reservas.filter(
      (r) =>
        r.depto_id === id &&
        r.fecha_checkin !== null &&
        r.fecha_checkin >= periodo.desde &&
        r.fecha_checkin < periodo.hasta,
    );
    const vivas = delPeriodo.filter((r) => !r.cancelada);
    const nochesVivas = vivas.reduce(
      (suma, r) => suma + (aDia(r.fecha_checkout!) - aDia(r.fecha_checkin!)),
      0,
    );
    const canceladas = delPeriodo.length - vivas.length;

    return {
      depto_id: id,
      noches_totales: total,
      noches_ocupadas: ocupadas,
      noches_bloqueadas: bloqueadas,
      noches_libres: total - ocupadas - bloqueadas,
      pct_ocupado: porcentaje(ocupadas, total),
      pct_bloqueado: porcentaje(bloqueadas, total),
      pct_libre: porcentaje(total - ocupadas - bloqueadas, total),
      reservas: vivas.length,
      estadia_promedio:
        vivas.length === 0 ? null : redondear(nochesVivas / vivas.length, 1),
      canceladas,
      pct_cancelacion:
        delPeriodo.length === 0 ? null : porcentaje(canceladas, delPeriodo.length),
    };
  });
}

/** El total de la operación: la suma de las noches, no el promedio de los %. */
export function totalizar(filas: OcupacionDepto[]): OcupacionDepto {
  const suma = (campo: keyof OcupacionDepto) =>
    filas.reduce((a, f) => a + ((f[campo] as number) ?? 0), 0);

  const totales = suma("noches_totales");
  const ocupadas = suma("noches_ocupadas");
  const bloqueadas = suma("noches_bloqueadas");
  const reservas = suma("reservas");
  const canceladas = suma("canceladas");

  // El promedio general pondera por cantidad de reservas: si no, un depto con
  // una sola reserva larga pesa igual que uno con veinte.
  const nochesReservadas = filas.reduce(
    (a, f) => a + (f.estadia_promedio ?? 0) * f.reservas,
    0,
  );

  return {
    depto_id: "",
    noches_totales: totales,
    noches_ocupadas: ocupadas,
    noches_bloqueadas: bloqueadas,
    noches_libres: totales - ocupadas - bloqueadas,
    pct_ocupado: porcentaje(ocupadas, totales),
    pct_bloqueado: porcentaje(bloqueadas, totales),
    pct_libre: porcentaje(totales - ocupadas - bloqueadas, totales),
    reservas,
    estadia_promedio: reservas === 0 ? null : redondear(nochesReservadas / reservas, 1),
    canceladas,
    pct_cancelacion:
      reservas + canceladas === 0 ? null : porcentaje(canceladas, reservas + canceladas),
  };
}

function porcentaje(parte: number, total: number): number {
  return total === 0 ? 0 : redondear((parte / total) * 100, 1);
}

function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales;
  return Math.round(valor * factor) / factor;
}
