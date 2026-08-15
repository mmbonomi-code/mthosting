import { describe, expect, it } from "vitest";
import {
  agregarPorDeptoMes,
  aporteDeMovimiento,
  ganancia,
  saldoPropietario,
  totalizar,
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

/** Atajo: el aporte de un movimiento, que en estos casos nunca es null. */
const de = (m: Partial<MovimientoCalculable>, pct = 20) =>
  aporteDeMovimiento(mov(m), pct)!;

describe("la ganancia", () => {
  it("comisiona el alquiler y se queda la limpieza entera", () => {
    // 100 de alquiler + 20 de limpieza, al 20%: 100×0,20 + 20 = 40.
    const a = de({ monto: 120, tarifa_limpieza: 20 });
    cerca(a.comision, 20);
    cerca(a.limpieza, 20);
    cerca(ganancia(a), 40);
  });

  it("abre las dos mitades, que son negocios distintos", () => {
    // Una estadía larga y una corta con la misma limpieza: la comisión las
    // separa, la limpieza no. Sumadas en un solo número, eso no se ve.
    const larga = de({ monto: 500, tarifa_limpieza: 25 });
    const corta = de({ monto: 120, tarifa_limpieza: 25 });
    expect(larga.comision).toBeGreaterThan(corta.comision);
    expect(larga.limpieza).toBe(corta.limpieza);
  });

  it("sin limpieza es la comisión pelada", () => {
    const a = de({ monto: 100 });
    cerca(a.comision, 20);
    cerca(a.limpieza, 0);
  });

  it("respeta el porcentaje de cada departamento", () => {
    cerca(ganancia(de({ monto: 100 }, 15)), 15);
    cerca(ganancia(de({ monto: 100 }, 25)), 25);
  });

  it("los cobros de resolución y ajustes comisionan sin limpieza", () => {
    for (const categoria of ["resolucion", "ajuste", "tarifa_cancelacion"] as const) {
      const a = de({ categoria, monto: 50 });
      cerca(a.comision, 10);
      cerca(a.limpieza, 0);
    }
  });

  it("un ajuste negativo resta", () => {
    cerca(ganancia(de({ categoria: "ajuste", monto: -50 })), -10);
  });

  it("NO la mueve lo que se cobró: eso es el percibido", () => {
    // La misma reserva de 120, con una línea de coanfitrión del 80% porque el
    // propietario debía plata. La ganancia tiene que seguir siendo 40.
    const reserva = de({ monto: 120, tarifa_limpieza: 20 });
    const coanfitrion = de({ categoria: "coanfitrion", monto: -100 });
    cerca(ganancia(reserva), 40);
    cerca(ganancia(coanfitrion), 0);
    // Entró mucho más de lo que se ganó. Eso es recupero, no rentabilidad.
    cerca(coanfitrion.percibido, 100);
  });
});

describe("el percibido", () => {
  it("invierte el signo del coanfitrión, que viene negativo", () => {
    cerca(de({ categoria: "coanfitrion", monto: -88.36 }).percibido, 88.36);
  });

  it("una devolución de comisión RESTA, no suma", () => {
    // KENNEDY 1, HMFQKSZYF8: −88,36 y después +5,89 de devolución.
    // Sumando con el signo dado vuelta: 88,36 − 5,89 = 82,47.
    // Con abs() fila por fila daría 94,25, un error de 11,78 en una reserva.
    const a = de({ categoria: "coanfitrion", monto: -88.36 });
    const b = de({ categoria: "coanfitrion", monto: 5.89 });
    cerca(a.percibido + b.percibido, 82.47);
  });

  it("un payout a cuenta del propietario no entra", () => {
    const a = de({ categoria: "payout", cobrado: 327.49, clase_cuenta: "propietario" });
    cerca(a.percibido, 0);
    cerca(a.custodia, 0);
  });

  it("una cuenta sin clasificar no entra todavía", () => {
    cerca(
      de({ categoria: "payout", cobrado: 500, clase_cuenta: "sin_clasificar" }).percibido,
      0,
    );
  });

  it("un payout a cuenta MTH sin coanfitrión en el grupo es ingreso propio", () => {
    const a = de({ categoria: "payout", cobrado: 81.11, clase_cuenta: "mth" });
    cerca(a.percibido, 81.11);
    cerca(a.custodia, 0);
  });

  it("un payout a cuenta MTH CON coanfitrión también entra: es plata que entró", () => {
    // ARENALES 2: payout de 327,49 a la 4343, con coanfitrión de 87,57 en el
    // mismo grupo. Los 327,49 son en el fondo del propietario, pero ENTRARON
    // a una cuenta de MTHosting (decisión de Marcos, 15/08/2026). Se marcan
    // como custodia para la etapa 2, sin restarlos.
    const a = de({
      categoria: "payout",
      cobrado: 327.49,
      clase_cuenta: "mth",
      grupo_con_coanfitrion: true,
    });
    cerca(a.percibido, 327.49);
    cerca(a.custodia, 327.49);
  });

  it("el payout y su coanfitrión no se pisan: juntos dan el bruto, una vez", () => {
    // Reserva 415,06 = coanfitrión 87,57 + payout 327,49. El payout ya viene
    // neto de lo derivado al coanfitrión, así que sumarlos no duplica nada.
    const coanfitrion = de({ categoria: "coanfitrion", monto: -87.57 });
    const payout = de({
      categoria: "payout",
      cobrado: 327.49,
      clase_cuenta: "mth",
      grupo_con_coanfitrion: true,
    });
    cerca(coanfitrion.percibido + payout.percibido, 415.06);
  });
});

describe("el saldo con el propietario", () => {
  it("positivo quiere decir que MTHosting le debe", () => {
    // Entró el bruto de 415,06 y la ganancia es la comisión de 83,01.
    cerca(
      saldoPropietario({
        comision: 83.01,
        limpieza: 0,
        percibido: 415.06,
        aircover: 0,
        custodia: 327.49,
      }),
      332.05,
    );
  });

  it("negativo quiere decir que le deben a MTHosting", () => {
    cerca(
      saldoPropietario({
        comision: 40,
        limpieza: 20,
        percibido: 50,
        aircover: 0,
        custodia: 0,
      }),
      -10,
    );
  });

  it("cuenta la limpieza como parte de lo ganado", () => {
    // Sin contarla, el saldo diría que MTHosting cobró de más 20 dólares que
    // en realidad le corresponden enteros.
    cerca(
      saldoPropietario({
        comision: 20,
        limpieza: 20,
        percibido: 40,
        aircover: 0,
        custodia: 0,
      }),
      0,
    );
  });
});

describe("el AirCover", () => {
  it("no suma a ganancia ni a percibido, se informa aparte", () => {
    // KENNEDY 1, HMYEW9WZZX, USD 6,00 el 26/04/2026. Decisión de Marcos
    // (15/08/2026): queda afuera de las dos cifras.
    const a = de({ categoria: "aircover", monto: 6 });
    cerca(ganancia(a), 0);
    cerca(a.percibido, 0);
    cerca(a.aircover, 6);
  });
});

describe("las monedas", () => {
  it("convierte a dólares con el tipo de cambio del grupo", () => {
    const a = de({
      categoria: "payout",
      cobrado: 145000,
      moneda: "ARS",
      clase_cuenta: "mth",
      tc_usd: 1450,
    });
    cerca(a.percibido, 100);
  });

  it("convierte también la limpieza, no solo el monto", () => {
    const a = de({ monto: 145000, tarifa_limpieza: 29000, moneda: "ARS", tc_usd: 1450 });
    cerca(a.limpieza, 20);
    cerca(a.comision, 16); // (100 − 20) × 0,20
  });

  it("sin tipo de cambio devuelve null en vez de inventar uno", () => {
    expect(
      aporteDeMovimiento(
        mov({ categoria: "payout", cobrado: 145000, moneda: "ARS", clase_cuenta: "mth" }),
        20,
      ),
    ).toBeNull();
  });
});

describe("la agregación por departamento y mes", () => {
  const filas = (): FilaAgregable[] => [
    {
      ...mov({ monto: 120, tarifa_limpieza: 20 }),
      depto_id: "A",
      fecha: "2026-04-03",
      noches: 3,
    },
    { ...mov({ categoria: "coanfitrion", monto: -24 }), depto_id: "A", fecha: "2026-04-03" },
    { ...mov({ monto: 100 }), depto_id: "A", fecha: "2026-05-11", noches: 2 },
    {
      ...mov({ monto: 200, tarifa_limpieza: 50 }),
      depto_id: "B",
      fecha: "2026-04-20",
      noches: 5,
    },
    { ...mov({ categoria: "aircover", monto: 6 }), depto_id: "A", fecha: "2026-04-26" },
  ];
  const comision = new Map([
    ["A", 20],
    ["B", 20],
  ]);

  it("separa cada departamento y cada mes", () => {
    const { celdas } = agregarPorDeptoMes(filas(), comision);
    expect(celdas.map((c) => `${c.depto_id}/${c.mes}`)).toEqual([
      "A/2026-04",
      "A/2026-05",
      "B/2026-04",
    ]);
  });

  it("suma bien dentro de la celda y cuenta reservas y noches", () => {
    const { celdas } = agregarPorDeptoMes(filas(), comision);
    const abril = celdas.find((c) => c.depto_id === "A" && c.mes === "2026-04")!;
    cerca(abril.comision, 20);
    cerca(abril.limpieza, 20);
    cerca(ganancia(abril), 40);
    cerca(abril.percibido, 24);
    cerca(abril.aircover, 6);
    expect(abril.reservas).toBe(1);
    expect(abril.noches).toBe(3);
    cerca(saldoPropietario(abril), -16);
  });

  it("usa el porcentaje de cada departamento, no uno global", () => {
    const { celdas } = agregarPorDeptoMes(
      filas(),
      new Map([
        ["A", 20],
        ["B", 10],
      ]),
    );
    // 150×0,10 de comisión + 50 de limpieza.
    cerca(ganancia(celdas.find((c) => c.depto_id === "B")!), 65);
  });

  it("no pierde las filas sin departamento: las cuenta", () => {
    const conHuerfana = [
      ...filas(),
      { ...mov({ monto: 999 }), depto_id: null, fecha: "2026-04-01" },
    ];
    const r = agregarPorDeptoMes(conHuerfana, comision);
    expect(r.sinDepartamento).toBe(1);
    // Y no se coló en ninguna celda: 40 de A/abril + 20 de A/mayo + 80 de B.
    cerca(ganancia(totalizar(r.celdas)), 140);
  });

  it("no pierde las filas que no se pudieron convertir", () => {
    const conArs = [
      ...filas(),
      { ...mov({ monto: 50000, moneda: "ARS" }), depto_id: "A", fecha: "2026-04-01" },
    ];
    expect(agregarPorDeptoMes(conArs, comision).sinConvertir).toBe(1);
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
    cerca(ganancia(celdas[0]), 20.004);
  });
});

describe("totalizar", () => {
  it("suma las partes por separado, no un total ya sumado", () => {
    const t = totalizar([
      { comision: 10, limpieza: 5, percibido: 12, aircover: 1, custodia: 0 },
      { comision: 20, limpieza: 7, percibido: 30, aircover: 0, custodia: 4 },
    ]);
    cerca(t.comision, 30);
    cerca(t.limpieza, 12);
    cerca(ganancia(t), 42);
    cerca(t.percibido, 42);
    cerca(t.aircover, 1);
    cerca(t.custodia, 4);
  });

  it("de una lista vacía da todo en cero", () => {
    cerca(ganancia(totalizar([])), 0);
  });
});
