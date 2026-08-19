import { describe, expect, it } from "vitest";
import {
  calcularRentabilidad,
  esGastoReal,
  medianaDe,
  tcRepresentativoPorMes,
  type GastoCaja,
} from "./rentabilidad";

const gasto = (g: Partial<GastoCaja>): GastoCaja => ({
  fecha: "2026-02-10",
  monto: 100,
  tc: 1400,
  tipo: "egreso",
  reembolsable: false,
  activo: true,
  ...g,
});

describe("esGastoReal", () => {
  it("un egreso normal es real", () => {
    expect(esGastoReal(gasto({}))).toBe(true);
  });

  it("un ingreso no es un gasto", () => {
    expect(esGastoReal(gasto({ tipo: "ingreso" }))).toBe(false);
  });

  it("lo que reembolsa el propietario no es un gasto real, esté cobrado o no", () => {
    // El pedido explícito de Marcos: no importa `fecha_cobro`, solo `reembolsable`.
    expect(esGastoReal(gasto({ reembolsable: true }))).toBe(false);
  });

  it("un movimiento dado de baja no cuenta", () => {
    expect(esGastoReal(gasto({ activo: false }))).toBe(false);
  });
});

describe("medianaDe", () => {
  it("de una lista vacía no opina", () => {
    expect(medianaDe([])).toBeNull();
  });

  it("el del medio en una lista impar", () => {
    expect(medianaDe([1400, 1420, 1500])).toBe(1420);
  });

  it("no lo mueve un solo valor disparatado", () => {
    // Un TC de 90.000 metido en el medio de valores normales: el promedio se
    // dispararía, la mediana no.
    const conRoto = [1400, 1410, 1420, 1430, 90000];
    expect(medianaDe(conRoto)).toBe(1420);
  });
});

describe("tcRepresentativoPorMes", () => {
  it("agrupa por mes y toma la mediana de cada uno", () => {
    const m = tcRepresentativoPorMes([
      { fecha: "2026-02-01", tc: 1400 },
      { fecha: "2026-02-10", tc: 1410 },
      { fecha: "2026-02-15", tc: 1420 },
      { fecha: "2026-03-01", tc: 1500 },
    ]);
    expect(m.get("2026-02")).toBe(1410);
    expect(m.get("2026-03")).toBe(1500);
  });

  it("un mes sin cotizaciones no aparece", () => {
    const m = tcRepresentativoPorMes([{ fecha: "2026-02-01", tc: 1400 }]);
    expect(m.has("2026-03")).toBe(false);
  });
});

describe("calcularRentabilidad", () => {
  const ganancia = new Map([
    ["2026-02", 14362],
    ["2026-06", 14532],
  ]);
  const cotizaciones = [
    { fecha: "2026-02-05", tc: 1400 },
    { fecha: "2026-02-20", tc: 1420 },
  ];

  it("resta gastos reales a la ganancia, en USD", () => {
    const gastos = [
      gasto({ fecha: "2026-02-03", monto: 700000, tc: 1400 }),
      gasto({ fecha: "2026-02-18", monto: 300000, tc: 1400 }),
    ];
    const filas = calcularRentabilidad(ganancia, gastos, cotizaciones, "2026-02");
    const feb = filas.find((f) => f.mes === "2026-02")!;
    expect(feb.gastosUsd).toBeCloseTo(714.29, 1);
    expect(feb.resultadoUsd).toBeCloseTo(14362 - 714.29, 1);
  });

  it("no resta lo reembolsable, esté cobrado o no", () => {
    const gastos = [
      gasto({ fecha: "2026-02-03", monto: 500000, reembolsable: true }),
      gasto({ fecha: "2026-02-04", monto: 200000, reembolsable: false }),
    ];
    const filas = calcularRentabilidad(ganancia, gastos, cotizaciones, "2026-02");
    const feb = filas.find((f) => f.mes === "2026-02")!;
    // Solo entran los 200.000, no los 500.000 reembolsables.
    expect(feb.gastosArs).toBe(200000);
  });

  it("convierte la ganancia a pesos con la mediana del mes", () => {
    const filas = calcularRentabilidad(ganancia, [], cotizaciones, "2026-02");
    const feb = filas.find((f) => f.mes === "2026-02")!;
    // mediana(1400, 1420) = 1420: con dos valores, el índice floor(2/2)=1.
    expect(feb.gananciaArs).toBeCloseTo(14362 * 1420, 0);
  });

  it("un mes sin ninguna cotización deja la ganancia en pesos sin resolver", () => {
    const filas = calcularRentabilidad(ganancia, [], [], "2026-02");
    const feb = filas.find((f) => f.mes === "2026-02")!;
    expect(feb.gananciaArs).toBeNull();
    expect(feb.resultadoArs).toBeNull();
    // El de dólares sí está: no depende de la cotización de Caja.
    expect(feb.resultadoUsd).toBe(14362);
  });

  it("cuenta los gastos que no se pudieron convertir, sin descartarlos del total en pesos", () => {
    const gastos = [
      gasto({ fecha: "2026-02-03", monto: 100000, tc: null }),
      gasto({ fecha: "2026-02-04", monto: 50000, tc: 1400 }),
    ];
    const filas = calcularRentabilidad(ganancia, gastos, cotizaciones, "2026-02");
    const feb = filas.find((f) => f.mes === "2026-02")!;
    expect(feb.gastosArs).toBe(150000); // los dos, en pesos no hace falta TC
    expect(feb.gastosSinConvertir).toBe(1);
    expect(feb.gastosUsd).toBeCloseTo(50000 / 1400, 1); // solo el que sí convirtió
  });

  it("ignora los meses anteriores al arranque", () => {
    const conEnero = new Map([...ganancia, ["2026-01", 999]]);
    const filas = calcularRentabilidad(conEnero, [], cotizaciones, "2026-02");
    expect(filas.some((f) => f.mes === "2026-01")).toBe(false);
  });

  it("un mes con gastos pero sin ganancia calculada todavía aparece igual", () => {
    const gastos = [gasto({ fecha: "2026-04-05", monto: 100000, tc: 1400 })];
    const filas = calcularRentabilidad(ganancia, gastos, cotizaciones, "2026-02");
    const abril = filas.find((f) => f.mes === "2026-04")!;
    expect(abril.gananciaUsd).toBe(0);
    expect(abril.gastosArs).toBe(100000);
  });

  it("ordena los meses cronológicamente", () => {
    const filas = calcularRentabilidad(ganancia, [], cotizaciones, "2026-02");
    expect(filas.map((f) => f.mes)).toEqual(["2026-02", "2026-06"]);
  });
});
