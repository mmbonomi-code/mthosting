import { describe, expect, it } from "vitest";
import {
  nochesDelPeriodo,
  ocupacionPorDepto,
  totalizar,
  type BloqueoOcupacion,
  type ReservaOcupacion,
} from "./ocupacion";

/** Enero de 2026: 31 noches, prolijo para hacer las cuentas a mano. */
const ENERO = { desde: "2026-01-01", hasta: "2026-02-01" };
const A = "depto-a";
const B = "depto-b";

function reserva(p: Partial<ReservaOcupacion> = {}): ReservaOcupacion {
  return {
    depto_id: A,
    fecha_checkin: "2026-01-10",
    fecha_checkout: "2026-01-12",
    cancelada: false,
    ...p,
  };
}

function bloqueo(p: Partial<BloqueoOcupacion> = {}): BloqueoOcupacion {
  return {
    depto_id: A,
    fecha_desde: "2026-01-20",
    fecha_hasta: "2026-01-22",
    ...p,
  };
}

const soloA = (
  reservas: ReservaOcupacion[],
  bloqueos: BloqueoOcupacion[] = [],
  periodo = ENERO,
) => ocupacionPorDepto([A], reservas, bloqueos, periodo)[0];

describe("nochesDelPeriodo", () => {
  it("enero tiene 31 noches", () => {
    expect(nochesDelPeriodo(ENERO)).toBe(31);
  });

  it("febrero de un año bisiesto tiene 29", () => {
    expect(nochesDelPeriodo({ desde: "2028-02-01", hasta: "2028-03-01" })).toBe(29);
  });

  it("un período al revés no da negativo", () => {
    expect(nochesDelPeriodo({ desde: "2026-02-01", hasta: "2026-01-01" })).toBe(0);
  });
});

describe("ocupacionPorDepto", () => {
  it("del 10 al 12 son 2 noches, no 3: el día de check-out no se cuenta", () => {
    expect(soloA([reserva()]).noches_ocupadas).toBe(2);
  });

  it("un departamento sin nada figura igual, en cero", () => {
    const fila = soloA([]);
    expect(fila).toMatchObject({
      noches_ocupadas: 0,
      noches_bloqueadas: 0,
      noches_libres: 31,
      pct_ocupado: 0,
      reservas: 0,
      estadia_promedio: null,
      pct_cancelacion: null,
    });
  });

  it("las canceladas no ocupan noches", () => {
    expect(soloA([reserva({ cancelada: true })]).noches_ocupadas).toBe(0);
  });

  it("dos reservas que se pisan no cuentan la noche dos veces", () => {
    const fila = soloA([
      reserva({ fecha_checkin: "2026-01-10", fecha_checkout: "2026-01-15" }),
      reserva({ fecha_checkin: "2026-01-12", fecha_checkout: "2026-01-16" }),
    ]);
    // Del 10 al 16 son 6 noches, no 5 + 4.
    expect(fila.noches_ocupadas).toBe(6);
  });

  it("la ocupación nunca pasa del 100%", () => {
    const muchas = Array.from({ length: 20 }, () =>
      reserva({ fecha_checkin: "2026-01-01", fecha_checkout: "2026-02-01" }),
    );
    expect(soloA(muchas).pct_ocupado).toBe(100);
  });

  it("recorta lo que se sale del período por los dos lados", () => {
    const fila = soloA([
      // Entró en diciembre y se va el 3: aporta las noches del 1 y el 2.
      reserva({ fecha_checkin: "2025-12-28", fecha_checkout: "2026-01-03" }),
      // Entra el 30 y se va en febrero: aporta el 30 y el 31.
      reserva({ fecha_checkin: "2026-01-30", fecha_checkout: "2026-02-05" }),
    ]);
    expect(fila.noches_ocupadas).toBe(4);
  });

  it("una reserva enteramente fuera del período no aporta nada", () => {
    const fila = soloA([
      reserva({ fecha_checkin: "2026-03-01", fecha_checkout: "2026-03-05" }),
    ]);
    expect(fila.noches_ocupadas).toBe(0);
    expect(fila.reservas).toBe(0);
  });

  it("separa ocupadas, bloqueadas y libres", () => {
    const fila = soloA([reserva()], [bloqueo()]);
    expect(fila).toMatchObject({
      noches_ocupadas: 2,
      noches_bloqueadas: 2,
      noches_libres: 27,
    });
    expect(fila.pct_ocupado).toBe(6.5);
    expect(fila.pct_bloqueado).toBe(6.5);
    expect(fila.pct_libre).toBe(87.1);
  });

  it("los tres porcentajes salen de las noches, no de restar el resto", () => {
    // 2 + 2 + 27 sobre 31 da 6,5 / 6,5 / 87,1: por resta daría 87,0.
    const fila = soloA([reserva()], [bloqueo()]);
    expect(fila.pct_libre).not.toBe(
      Math.round((100 - fila.pct_ocupado - fila.pct_bloqueado) * 10) / 10,
    );
  });

  it("una noche ocupada Y bloqueada cuenta como ocupada, no dos veces", () => {
    const fila = soloA(
      [reserva({ fecha_checkin: "2026-01-20", fecha_checkout: "2026-01-22" })],
      [bloqueo()],
    );
    expect(fila.noches_ocupadas).toBe(2);
    expect(fila.noches_bloqueadas).toBe(0);
    expect(fila.noches_ocupadas + fila.noches_bloqueadas + fila.noches_libres).toBe(31);
  });

  it("los tres estados siempre suman el total", () => {
    const fila = soloA(
      [reserva(), reserva({ fecha_checkin: "2026-01-25", fecha_checkout: "2026-01-28" })],
      [bloqueo(), bloqueo({ fecha_desde: "2026-01-05", fecha_hasta: "2026-01-09" })],
    );
    expect(fila.noches_ocupadas + fila.noches_bloqueadas + fila.noches_libres).toBe(
      fila.noches_totales,
    );
  });

  it("no mezcla departamentos", () => {
    const filas = ocupacionPorDepto(
      [A, B],
      [reserva({ depto_id: B, fecha_checkin: "2026-01-01", fecha_checkout: "2026-01-06" })],
      [bloqueo({ depto_id: A })],
      ENERO,
    );
    expect(filas[0]).toMatchObject({ noches_ocupadas: 0, noches_bloqueadas: 2 });
    expect(filas[1]).toMatchObject({ noches_ocupadas: 5, noches_bloqueadas: 0 });
  });

  it("una reserva de un depto que no está en la lista se ignora", () => {
    expect(soloA([reserva({ depto_id: "otro" })]).noches_ocupadas).toBe(0);
  });

  it("una reserva sin fechas no rompe nada", () => {
    expect(
      soloA([reserva({ fecha_checkin: null, fecha_checkout: null })]).noches_ocupadas,
    ).toBe(0);
  });
});

describe("estadía promedio y cancelación", () => {
  it("promedia las noches reales, sin recortar por el período", () => {
    // Entra el 30 de enero por 6 noches: la estadía es de 6, aunque en enero
    // solo caigan 2.
    const fila = soloA([
      reserva({ fecha_checkin: "2026-01-30", fecha_checkout: "2026-02-05" }),
    ]);
    expect(fila.estadia_promedio).toBe(6);
    expect(fila.noches_ocupadas).toBe(2);
  });

  it("solo cuenta las que EMPIEZAN en el período", () => {
    const fila = soloA([
      reserva({ fecha_checkin: "2025-12-28", fecha_checkout: "2026-01-03" }),
      reserva({ fecha_checkin: "2026-01-10", fecha_checkout: "2026-01-14" }),
    ]);
    expect(fila.reservas).toBe(1);
    expect(fila.estadia_promedio).toBe(4);
  });

  it("promedia con un decimal", () => {
    const fila = soloA([
      reserva({ fecha_checkin: "2026-01-02", fecha_checkout: "2026-01-04" }),
      reserva({ fecha_checkin: "2026-01-10", fecha_checkout: "2026-01-13" }),
    ]);
    expect(fila.estadia_promedio).toBe(2.5);
  });

  it("las canceladas no entran en el promedio pero sí en la tasa", () => {
    const fila = soloA([
      reserva({ fecha_checkin: "2026-01-02", fecha_checkout: "2026-01-04" }),
      reserva({
        fecha_checkin: "2026-01-10",
        fecha_checkout: "2026-01-30",
        cancelada: true,
      }),
    ]);
    expect(fila.estadia_promedio).toBe(2);
    expect(fila.reservas).toBe(1);
    expect(fila.canceladas).toBe(1);
    expect(fila.pct_cancelacion).toBe(50);
  });
});

describe("totalizar", () => {
  it("suma noches, no promedia porcentajes", () => {
    const filas = ocupacionPorDepto(
      [A, B],
      [
        // A: lleno el mes entero.
        reserva({ depto_id: A, fecha_checkin: "2026-01-01", fecha_checkout: "2026-02-01" }),
        // B: nada.
      ],
      [],
      ENERO,
    );
    const total = totalizar(filas);
    expect(total.noches_totales).toBe(62);
    expect(total.noches_ocupadas).toBe(31);
    expect(total.pct_ocupado).toBe(50);
  });

  it("el promedio de estadía pondera por cantidad de reservas", () => {
    const filas = ocupacionPorDepto(
      [A, B],
      [
        // A: tres reservas de 2 noches.
        reserva({ fecha_checkin: "2026-01-02", fecha_checkout: "2026-01-04" }),
        reserva({ fecha_checkin: "2026-01-06", fecha_checkout: "2026-01-08" }),
        reserva({ fecha_checkin: "2026-01-10", fecha_checkout: "2026-01-12" }),
        // B: una sola de 10 noches.
        reserva({ depto_id: B, fecha_checkin: "2026-01-05", fecha_checkout: "2026-01-15" }),
      ],
      [],
      ENERO,
    );
    // (2+2+2+10) / 4 = 4, no el promedio de los promedios (2 y 10 → 6).
    expect(totalizar(filas).estadia_promedio).toBe(4);
  });

  it("sin departamentos no divide por cero", () => {
    expect(totalizar([])).toMatchObject({
      noches_totales: 0,
      pct_ocupado: 0,
      estadia_promedio: null,
      pct_cancelacion: null,
    });
  });
});
