import { describe, expect, it } from "vitest";
import {
  agregarPorDeptoMes,
  aporteDeMovimiento,
  brecha,
  type FilaAgregable,
  type MovimientoCalculable,
} from "./calcular";

/** Una fila mínima, para que cada test diga solo lo que le importa. */
const mov = (m: Partial<MovimientoCalculable>): MovimientoCalculable => ({
  categoria: "reserva",
  monto: 0,
  cobrado: null,
  tarifa_limpieza: null,
  moneda: "USD",
  ...m,
});

const cerca = (n: number | undefined, esperado: number) =>
  expect(n).toBeCloseTo(esperado, 6);

describe("la ganancia", () => {
  it("comisiona el alquiler y se queda la limpieza entera", () => {
    // 100 de alquiler + 20 de limpieza, al 20%: 100×0,20 + 20 = 40.
    const a = aporteDeMovimiento(mov({ monto: 120, tarifa_limpieza: 20 }), 20);
    cerca(a?.ganancia, 40);
  });

  it("sin limpieza es la comisión pelada", () => {
    cerca(aporteDeMovimiento(mov({ monto: 100 }), 20)?.ganancia, 20);
  });

  it("respeta el porcentaje de cada departamento", () => {
    cerca(aporteDeMovimiento(mov({ monto: 100 }), 15)?.ganancia, 15);
    cerca(aporteDeMovimiento(mov({ monto: 100 }), 25)?.ganancia, 25);
  });

  it("los cobros de resolución y ajustes comisionan sin descontar limpieza", () => {
    for (const categoria of ["resolucion", "ajuste", "tarifa_cancelacion"] as const) {
      cerca(aporteDeMovimiento(mov({ categoria, monto: 50 }), 20)?.ganancia, 10);
    }
  });

  it("un ajuste negativo resta", () => {
    cerca(aporteDeMovimiento(mov({ categoria: "ajuste", monto: -50 }), 20)?.ganancia, -10);
  });

  it("NO la mueve lo que se cobró: eso es el percibido", () => {
    // La misma reserva de 120, con una línea de coanfitrión del 80% porque el
    // propietario debía plata. La ganancia tiene que seguir siendo 40.
    const reserva = aporteDeMovimiento(mov({ monto: 120, tarifa_limpieza: 20 }), 20);
    const coanfitrion = aporteDeMovimiento(
      mov({ categoria: "coanfitrion", monto: -100 }),
      20,
    );
    cerca(reserva?.ganancia, 40);
    cerca(coanfitrion?.ganancia, 0);
    // Entró mucho más de lo que se ganó. Eso es recupero, no rentabilidad.
    cerca(coanfitrion?.percibido, 100);
  });
});

describe("el percibido", () => {
  it("invierte el signo del coanfitrión, que viene negativo", () => {
    cerca(aporteDeMovimiento(mov({ categoria: "coanfitrion", monto: -88.36 }), 20)?.percibido, 88.36);
  });

  it("una devolución de comisión RESTA, no suma", () => {
    // KENNEDY 1, HMFQKSZYF8: −88,36 y después +5,89 de devolución.
    // Sumando con el signo dado vuelta: 88,36 − 5,89 = 82,47.
    // Con abs() fila por fila daría 94,25, un error de 11,78 en una reserva.
    const a = aporteDeMovimiento(mov({ categoria: "coanfitrion", monto: -88.36 }), 20);
    const b = aporteDeMovimiento(mov({ categoria: "coanfitrion", monto: 5.89 }), 20);
    cerca(a!.percibido + b!.percibido, 82.47);
  });

  it("un payout a cuenta del propietario no entra", () => {
    const a = aporteDeMovimiento(
      mov({ categoria: "payout", cobrado: 327.49, clase_cuenta: "propietario" }),
      20,
    );
    cerca(a?.percibido, 0);
    cerca(a?.custodia, 0);
  });

  it("una cuenta sin clasificar no entra todavía", () => {
    const a = aporteDeMovimiento(
      mov({ categoria: "payout", cobrado: 500, clase_cuenta: "sin_clasificar" }),
      20,
    );
    cerca(a?.percibido, 0);
  });

  it("un payout a cuenta MTH sin coanfitrión en el grupo es ingreso propio", () => {
    const a = aporteDeMovimiento(
      mov({ categoria: "payout", cobrado: 81.11, clase_cuenta: "mth" }),
      20,
    );
    cerca(a?.percibido, 81.11);
    cerca(a?.custodia, 0);
  });

  it("un payout a cuenta MTH CON coanfitrión en el grupo es custodia", () => {
    // ARENALES 2: el payout de 327,49 a la 4343 es plata del propietario; lo
    // de MTHosting son los 87,57 del coanfitrión. Contar las dos puntas
    // inflaría el percibido y volvería inservible la brecha.
    const a = aporteDeMovimiento(
      mov({
        categoria: "payout",
        cobrado: 327.49,
        clase_cuenta: "mth",
        grupo_con_coanfitrion: true,
      }),
      20,
    );
    cerca(a?.percibido, 0);
    cerca(a?.custodia, 327.49);
  });
});

describe("el AirCover", () => {
  it("no suma a ganancia ni a percibido, se informa aparte", () => {
    // KENNEDY 1, HMYEW9WZZX, USD 6,00 el 26/04/2026. Decisión de Marcos
    // (15/08/2026): queda afuera de las dos cifras.
    const a = aporteDeMovimiento(mov({ categoria: "aircover", monto: 6 }), 20);
    cerca(a?.ganancia, 0);
    cerca(a?.percibido, 0);
    cerca(a?.aircover, 6);
  });
});

describe("las monedas", () => {
  it("convierte a dólares con el tipo de cambio del grupo", () => {
    const a = aporteDeMovimiento(
      mov({ categoria: "payout", cobrado: 145000, moneda: "ARS", clase_cuenta: "mth", tc_usd: 1450 }),
      20,
    );
    cerca(a?.percibido, 100);
  });

  it("sin tipo de cambio devuelve null en vez de inventar uno", () => {
    const a = aporteDeMovimiento(
      mov({ categoria: "payout", cobrado: 145000, moneda: "ARS", clase_cuenta: "mth" }),
      20,
    );
    expect(a).toBeNull();
  });
});

describe("la agregación por departamento y mes", () => {
  const filas = (): FilaAgregable[] => [
    { ...mov({ monto: 120, tarifa_limpieza: 20 }), depto_id: "A", fecha: "2026-04-03" },
    { ...mov({ categoria: "coanfitrion", monto: -24 }), depto_id: "A", fecha: "2026-04-03" },
    { ...mov({ monto: 100 }), depto_id: "A", fecha: "2026-05-11" },
    { ...mov({ monto: 200, tarifa_limpieza: 50 }), depto_id: "B", fecha: "2026-04-20" },
    { ...mov({ categoria: "aircover", monto: 6 }), depto_id: "A", fecha: "2026-04-26" },
  ];

  it("separa cada departamento y cada mes", () => {
    const { celdas } = agregarPorDeptoMes(filas(), new Map([["A", 20], ["B", 20]]));
    expect(celdas.map((c) => `${c.depto_id}/${c.mes}`)).toEqual([
      "A/2026-04",
      "A/2026-05",
      "B/2026-04",
    ]);
  });

  it("suma bien dentro de la celda y cuenta las reservas", () => {
    const { celdas } = agregarPorDeptoMes(filas(), new Map([["A", 20], ["B", 20]]));
    const abril = celdas.find((c) => c.depto_id === "A" && c.mes === "2026-04")!;
    cerca(abril.ganancia, 40);
    cerca(abril.percibido, 24);
    cerca(abril.aircover, 6);
    expect(abril.reservas).toBe(1);
    cerca(brecha(abril), -16);
  });

  it("usa el porcentaje de cada departamento, no uno global", () => {
    const { celdas } = agregarPorDeptoMes(filas(), new Map([["A", 20], ["B", 10]]));
    cerca(celdas.find((c) => c.depto_id === "B")!.ganancia, 65); // 150×0,10 + 50
  });

  it("no pierde las filas sin departamento: las cuenta", () => {
    const conHuerfana = [
      ...filas(),
      { ...mov({ monto: 999 }), depto_id: null, fecha: "2026-04-01" },
    ];
    const r = agregarPorDeptoMes(conHuerfana, new Map([["A", 20], ["B", 20]]));
    expect(r.sinDepartamento).toBe(1);
    // Y no se coló en ninguna celda: 40 de A/abril + 20 de A/mayo + 80 de B.
    cerca(r.celdas.reduce((s, c) => s + c.ganancia, 0), 40 + 20 + 80);
  });

  it("no pierde las filas que no se pudieron convertir", () => {
    const conArs = [
      ...filas(),
      { ...mov({ monto: 50000, moneda: "ARS" }), depto_id: "A", fecha: "2026-04-01" },
    ];
    const r = agregarPorDeptoMes(conArs, new Map([["A", 20], ["B", 20]]));
    expect(r.sinConvertir).toBe(1);
  });

  it("no redondea antes de sumar", () => {
    // Tres reservas cuya comisión tiene tres decimales. Redondeando cada una
    // antes de sumar daría 20,01; la suma exacta es 20,004.
    const tres: FilaAgregable[] = [1, 2, 3].map((i) => ({
      ...mov({ monto: 33.34 }),
      depto_id: "A",
      fecha: `2026-04-0${i}`,
    }));
    const { celdas } = agregarPorDeptoMes(tres, new Map([["A", 20]]));
    cerca(celdas[0].ganancia, 20.004);
  });
});
