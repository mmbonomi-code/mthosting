import { describe, expect, it } from "vitest";
import {
  costoEnDolares,
  ordenarParaReparto,
  repartirCobertura,
  saldoDeBolsa,
  tcPromedio,
  tieneDescubierto,
  type MovimientoParaReparto,
} from "./cobertura";

const cambio = (
  id: string,
  fecha: string,
  usd: number,
  tc: number,
): MovimientoParaReparto => ({
  id,
  fecha,
  tipo: "ingreso",
  monto: usd * tc,
  tc_cambio: tc,
});

const ingreso = (id: string, fecha: string, monto: number): MovimientoParaReparto => ({
  id,
  fecha,
  tipo: "ingreso",
  monto,
  tc_cambio: null,
});

const gasto = (id: string, fecha: string, monto: number): MovimientoParaReparto => ({
  id,
  fecha,
  tipo: "egreso",
  monto,
  tc_cambio: null,
});

const de = (coberturas: ReturnType<typeof repartirCobertura>, id: string) =>
  coberturas.filter((c) => c.movimiento_id === id);

describe("ordenarParaReparto", () => {
  it("dentro del mismo día los ingresos van antes que los egresos", () => {
    // En el archivo de Ninox las filas están en el orden en que se anotaron.
    const orden = ordenarParaReparto([
      gasto("g", "2026-02-04", 100),
      cambio("c", "2026-02-04", 1, 1000),
    ]);
    expect(orden.map((m) => m.id)).toEqual(["c", "g"]);
  });

  it("ordena por fecha antes que por tipo", () => {
    const orden = ordenarParaReparto([
      cambio("c2", "2026-02-05", 1, 1000),
      gasto("g1", "2026-02-04", 100),
      cambio("c1", "2026-02-04", 1, 1000),
    ]);
    expect(orden.map((m) => m.id)).toEqual(["c1", "g1", "c2"]);
  });
});

describe("repartirCobertura", () => {
  it("un gasto se paga con la bolsa del cambio, no con el dólar del día", () => {
    const coberturas = repartirCobertura([
      cambio("c1", "2026-02-04", 1000, 1200), // 1.200.000 pesos
      gasto("g1", "2026-02-05", 120_000),
    ]);
    expect(de(coberturas, "g1")).toEqual([
      { movimiento_id: "g1", origen_id: "c1", monto: 120_000, tc: 1200 },
    ]);
  });

  it("las bolsas se consumen de la más vieja a la más nueva", () => {
    const coberturas = repartirCobertura([
      cambio("c1", "2026-02-04", 100, 1200), // 120.000
      cambio("c2", "2026-02-06", 100, 1300), // 130.000
      gasto("g1", "2026-02-07", 50_000),
    ]);
    expect(de(coberturas, "g1")).toEqual([
      { movimiento_id: "g1", origen_id: "c1", monto: 50_000, tc: 1200 },
    ]);
  });

  it("un gasto que cruza dos cambios se parte, cada parte a su tipo de cambio", () => {
    const coberturas = repartirCobertura([
      cambio("c1", "2026-02-04", 100, 1200), // 120.000
      cambio("c2", "2026-02-06", 100, 1300), // 130.000
      gasto("g1", "2026-02-07", 200_000),
    ]);
    expect(de(coberturas, "g1")).toEqual([
      { movimiento_id: "g1", origen_id: "c1", monto: 120_000, tc: 1200 },
      { movimiento_id: "g1", origen_id: "c2", monto: 80_000, tc: 1300 },
    ]);
  });

  it("un ingreso que no es cambio arma bolsa sin costo en dólares", () => {
    const coberturas = repartirCobertura([
      ingreso("i1", "2026-02-04", 120_000), // devolución de un propietario
      gasto("g1", "2026-02-05", 50_000),
    ]);
    expect(de(coberturas, "g1")).toEqual([
      { movimiento_id: "g1", origen_id: "i1", monto: 50_000, tc: null },
    ]);
  });

  it("lo descubierto lo cubre el cambio siguiente", () => {
    // El 16/6 se gastó más de lo que había: el cambio del 17 lo cubre.
    const coberturas = repartirCobertura([
      cambio("c1", "2026-06-15", 100, 1200), // 120.000
      gasto("g1", "2026-06-16", 200_000),
      cambio("c2", "2026-06-17", 100, 1250), // 125.000
    ]);
    expect(de(coberturas, "g1")).toEqual([
      { movimiento_id: "g1", origen_id: "c1", monto: 120_000, tc: 1200 },
      { movimiento_id: "g1", origen_id: "c2", monto: 80_000, tc: 1250 },
    ]);
  });

  it("lo pendiente se cobra antes que los gastos posteriores", () => {
    const coberturas = repartirCobertura([
      gasto("viejo", "2026-06-16", 100_000),
      cambio("c1", "2026-06-17", 100, 1200), // 120.000
      gasto("nuevo", "2026-06-18", 100_000),
    ]);
    // El viejo se lleva sus 100.000; al nuevo le quedan 20.000 y el resto
    // queda descubierto.
    expect(de(coberturas, "viejo")).toEqual([
      { movimiento_id: "viejo", origen_id: "c1", monto: 100_000, tc: 1200 },
    ]);
    expect(de(coberturas, "nuevo")).toEqual([
      { movimiento_id: "nuevo", origen_id: "c1", monto: 20_000, tc: 1200 },
      { movimiento_id: "nuevo", origen_id: null, monto: 80_000, tc: null },
    ]);
  });

  it("lo que nunca se cubre queda anotado como descubierto, no se esconde", () => {
    const coberturas = repartirCobertura([gasto("g1", "2026-02-04", 50_000)]);
    expect(de(coberturas, "g1")).toEqual([
      { movimiento_id: "g1", origen_id: null, monto: 50_000, tc: null },
    ]);
    expect(tieneDescubierto(de(coberturas, "g1"))).toBe(true);
  });

  it("cada peso gastado se reparte una sola vez", () => {
    const movimientos = [
      cambio("c1", "2026-02-04", 100, 1200),
      gasto("g1", "2026-02-05", 50_000),
      gasto("g2", "2026-02-06", 30_000),
      cambio("c2", "2026-02-07", 50, 1300),
      gasto("g3", "2026-02-08", 90_000),
    ];
    const coberturas = repartirCobertura(movimientos);

    for (const g of movimientos.filter((m) => m.tipo === "egreso")) {
      const repartido = de(coberturas, g.id).reduce((s, c) => s + c.monto, 0);
      expect(repartido).toBe(g.monto);
    }
  });

  it("no se reparte más plata de la que entró", () => {
    const coberturas = repartirCobertura([
      cambio("c1", "2026-02-04", 100, 1200), // 120.000
      gasto("g1", "2026-02-05", 200_000),
    ]);
    const desdeC1 = coberturas
      .filter((c) => c.origen_id === "c1")
      .reduce((s, c) => s + c.monto, 0);
    expect(desdeC1).toBe(120_000);
  });

  it("una caja sin movimientos no rompe", () => {
    expect(repartirCobertura([])).toEqual([]);
  });
});

describe("costoEnDolares", () => {
  it("suma los tramos, cada uno a su tipo de cambio", () => {
    const tramos = [
      { movimiento_id: "g", origen_id: "c1", monto: 120_000, tc: 1200 },
      { movimiento_id: "g", origen_id: "c2", monto: 130_000, tc: 1300 },
    ];
    // 100 + 100
    expect(costoEnDolares(tramos, null)).toBe(200);
  });

  it("los tramos sin cambio usan el dólar del día del gasto", () => {
    const tramos = [{ movimiento_id: "g", origen_id: "i1", monto: 100_000, tc: null }];
    expect(costoEnDolares(tramos, 1250)).toBe(80);
  });

  it("sin el dólar del día no inventa un número", () => {
    const tramos = [{ movimiento_id: "g", origen_id: "i1", monto: 100_000, tc: null }];
    expect(costoEnDolares(tramos, null)).toBeNull();
  });

  it("mezcla bolsa con cambio y bolsa sin cambio", () => {
    const tramos = [
      { movimiento_id: "g", origen_id: "c1", monto: 120_000, tc: 1200 }, // 100
      { movimiento_id: "g", origen_id: "i1", monto: 50_000, tc: null }, // 40 a 1250
    ];
    expect(costoEnDolares(tramos, 1250)).toBe(140);
  });
});

describe("tcPromedio", () => {
  it("es el promedio ponderado, no el de los dos números", () => {
    const tramos = [
      { movimiento_id: "g", origen_id: "c1", monto: 120_000, tc: 1200 }, // 100 usd
      { movimiento_id: "g", origen_id: "c2", monto: 13_000, tc: 1300 }, // 10 usd
    ];
    // 133.000 pesos / 110 dólares = 1209,09
    expect(tcPromedio(tramos, null)).toBe(1209.09);
  });
});

describe("saldoDeBolsa", () => {
  it("dice cuántos pesos del cambio todavía no gastó nadie", () => {
    const coberturas = repartirCobertura([
      cambio("c1", "2026-02-04", 100, 1200), // 120.000
      gasto("g1", "2026-02-05", 50_000),
    ]);
    expect(saldoDeBolsa("c1", 120_000, coberturas)).toBe(70_000);
  });

  it("una bolsa intacta tiene todo disponible", () => {
    expect(saldoDeBolsa("c1", 120_000, [])).toBe(120_000);
  });
});
