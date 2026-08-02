import { describe, expect, it } from "vitest";
import { congelarMonto, esPagoDoble, resolverTarifa, type Tarifa } from "./tarifas";

const SIN_FERIADOS = new Set<string>();

function tarifa(parcial: Partial<Tarifa> = {}): Tarifa {
  return {
    id: "t1",
    ambientes: "dos",
    depto_id: null,
    monto: 10000,
    moneda: "ARS",
    vigente_desde: "2026-01-01",
    vigente_hasta: null,
    ...parcial,
  };
}

describe("esPagoDoble", () => {
  it("los domingos se pagan doble", () => {
    // 2026-08-02 es domingo.
    expect(esPagoDoble("2026-08-02", SIN_FERIADOS)).toBe(true);
  });

  it("un lunes común no", () => {
    expect(esPagoDoble("2026-08-03", SIN_FERIADOS)).toBe(false);
  });

  it("un feriado cargado también se paga doble", () => {
    expect(esPagoDoble("2026-08-17", new Set(["2026-08-17"]))).toBe(true);
  });
});

describe("resolverTarifa", () => {
  it("toma la vigente a la fecha de la limpieza", () => {
    const vieja = tarifa({ id: "vieja", monto: 8000, vigente_desde: "2026-01-01", vigente_hasta: "2026-06-30" });
    const nueva = tarifa({ id: "nueva", monto: 12000, vigente_desde: "2026-07-01" });
    const encontrada = resolverTarifa([vieja, nueva], {
      deptoId: "d1",
      ambientes: "dos",
      fecha: "2026-08-15",
    });
    expect(encontrada?.id).toBe("nueva");
  });

  it("una limpieza vieja sigue resolviendo con la tarifa de su momento", () => {
    const vieja = tarifa({ id: "vieja", vigente_desde: "2026-01-01", vigente_hasta: "2026-06-30" });
    const nueva = tarifa({ id: "nueva", vigente_desde: "2026-07-01" });
    const encontrada = resolverTarifa([vieja, nueva], {
      deptoId: "d1",
      ambientes: "dos",
      fecha: "2026-03-10",
    });
    expect(encontrada?.id).toBe("vieja");
  });

  it("una tarifa puntual del departamento le gana a la general", () => {
    const general = tarifa({ id: "general", monto: 10000 });
    const puntual = tarifa({ id: "puntual", ambientes: null, depto_id: "d1", monto: 15000 });
    const encontrada = resolverTarifa([general, puntual], {
      deptoId: "d1",
      ambientes: "dos",
      fecha: "2026-08-15",
    });
    expect(encontrada?.id).toBe("puntual");
  });

  it("sin tarifa para esos ambientes devuelve null", () => {
    const encontrada = resolverTarifa([tarifa({ ambientes: "tres" })], {
      deptoId: "d1",
      ambientes: "monoambiente",
      fecha: "2026-08-15",
    });
    expect(encontrada).toBeNull();
  });
});

describe("congelarMonto", () => {
  it("congela el monto de la tarifa vigente", () => {
    const congelado = congelarMonto([tarifa()], SIN_FERIADOS, {
      deptoId: "d1",
      ambientes: "dos",
      fecha: "2026-08-03", // lunes
    });
    expect(congelado).toEqual({
      monto_pactado: 10000,
      moneda: "ARS",
      tarifa_id: "t1",
      pago_doble: false,
    });
  });

  it("el domingo se guarda ya duplicado: es lo que va a cobrar", () => {
    const congelado = congelarMonto([tarifa()], SIN_FERIADOS, {
      deptoId: "d1",
      ambientes: "dos",
      fecha: "2026-08-02", // domingo
    });
    expect(congelado.monto_pactado).toBe(20000);
    expect(congelado.pago_doble).toBe(true);
  });

  it("sin tarifa cargada se asigna igual, sin monto", () => {
    const congelado = congelarMonto([], SIN_FERIADOS, {
      deptoId: "d1",
      ambientes: "dos",
      fecha: "2026-08-03",
    });
    expect(congelado.monto_pactado).toBeNull();
    expect(congelado.tarifa_id).toBeNull();
  });
});
