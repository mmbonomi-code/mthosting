import { describe, expect, it } from "vitest";
import { congelarMonto, esPagoDoble, resolverTarifa, type Tarifa } from "./tarifas";

const SIN_FERIADOS = new Set<string>();
const LUNES = "2026-08-03";
const DOMINGO = "2026-08-02";

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

const criterio = (extra: Partial<Parameters<typeof congelarMonto>[2]> = {}) => ({
  deptoId: "d1",
  ambientes: "dos",
  fecha: LUNES,
  tipo: "normal",
  ...extra,
});

describe("esPagoDoble", () => {
  it("los domingos se pagan doble", () => {
    expect(esPagoDoble(DOMINGO, "normal", SIN_FERIADOS)).toBe(true);
  });

  it("un lunes común no", () => {
    expect(esPagoDoble(LUNES, "normal", SIN_FERIADOS)).toBe(false);
  });

  it("un feriado cargado también se paga doble", () => {
    expect(esPagoDoble("2026-08-17", "normal", new Set(["2026-08-17"]))).toBe(true);
  });

  it("la limpieza inicial se paga doble cualquier día", () => {
    expect(esPagoDoble(LUNES, "inicial", SIN_FERIADOS)).toBe(true);
  });

  it("la limpieza profunda se paga doble cualquier día", () => {
    expect(esPagoDoble(LUNES, "profunda", SIN_FERIADOS)).toBe(true);
  });

  it("un repaso en día común no es pago doble", () => {
    expect(esPagoDoble(LUNES, "repaso", SIN_FERIADOS)).toBe(false);
  });
});

describe("resolverTarifa", () => {
  it("rige desde su fecha de inicio, inclusive", () => {
    const t = tarifa({ vigente_desde: "2026-07-01" });
    expect(
      resolverTarifa([t], { deptoId: "d1", ambientes: "dos", fecha: "2026-07-01" })?.id,
    ).toBe("t1");
    expect(
      resolverTarifa([t], { deptoId: "d1", ambientes: "dos", fecha: "2026-06-30" }),
    ).toBeNull();
  });

  it("toma la vigente a la fecha de la limpieza", () => {
    const vieja = tarifa({ id: "vieja", monto: 8000, vigente_desde: "2026-01-01", vigente_hasta: "2026-06-30" });
    const nueva = tarifa({ id: "nueva", monto: 12000, vigente_desde: "2026-07-01" });
    expect(
      resolverTarifa([vieja, nueva], { deptoId: "d1", ambientes: "dos", fecha: "2026-08-15" })?.id,
    ).toBe("nueva");
  });

  it("una limpieza vieja sigue resolviendo con la tarifa de su momento", () => {
    const vieja = tarifa({ id: "vieja", vigente_desde: "2026-01-01", vigente_hasta: "2026-06-30" });
    const nueva = tarifa({ id: "nueva", vigente_desde: "2026-07-01" });
    expect(
      resolverTarifa([vieja, nueva], { deptoId: "d1", ambientes: "dos", fecha: "2026-03-10" })?.id,
    ).toBe("vieja");
  });

  it("una tarifa puntual del departamento le gana a la general", () => {
    const general = tarifa({ id: "general", monto: 10000 });
    const puntual = tarifa({ id: "puntual", ambientes: null, depto_id: "d1", monto: 15000 });
    expect(
      resolverTarifa([general, puntual], { deptoId: "d1", ambientes: "dos", fecha: "2026-08-15" })?.id,
    ).toBe("puntual");
  });

  it("sin tarifa para esos ambientes devuelve null", () => {
    expect(
      resolverTarifa([tarifa({ ambientes: "tres" })], {
        deptoId: "d1",
        ambientes: "monoambiente",
        fecha: "2026-08-15",
      }),
    ).toBeNull();
  });
});

describe("congelarMonto", () => {
  it("una limpieza común en día común paga el valor de la tarifa", () => {
    expect(congelarMonto([tarifa()], SIN_FERIADOS, criterio())).toEqual({
      monto_pactado: 10000,
      moneda: "ARS",
      tarifa_id: "t1",
      pago_doble: false,
    });
  });

  it("el domingo se guarda ya duplicado: es lo que va a cobrar", () => {
    const c = congelarMonto([tarifa()], SIN_FERIADOS, criterio({ fecha: DOMINGO }));
    expect(c.monto_pactado).toBe(20000);
    expect(c.pago_doble).toBe(true);
  });

  it("el repaso se paga la mitad", () => {
    const c = congelarMonto([tarifa()], SIN_FERIADOS, criterio({ tipo: "repaso" }));
    expect(c.monto_pactado).toBe(5000);
    expect(c.pago_doble).toBe(false);
  });

  it("la inicial y la profunda se pagan doble aunque sea un lunes", () => {
    for (const tipo of ["inicial", "profunda"]) {
      const c = congelarMonto([tarifa()], SIN_FERIADOS, criterio({ tipo }));
      expect(c.monto_pactado).toBe(20000);
      expect(c.pago_doble).toBe(true);
    }
  });

  it("el pago doble no se acumula: una inicial en domingo se paga doble, no cuádruple", () => {
    const c = congelarMonto([tarifa()], SIN_FERIADOS, criterio({ tipo: "inicial", fecha: DOMINGO }));
    expect(c.monto_pactado).toBe(20000);
  });

  it("un repaso en domingo combina las dos reglas y queda en el valor común", () => {
    const c = congelarMonto([tarifa()], SIN_FERIADOS, criterio({ tipo: "repaso", fecha: DOMINGO }));
    expect(c.monto_pactado).toBe(10000);
    expect(c.pago_doble).toBe(true);
  });

  it("sin tarifa cargada se asigna igual, sin monto", () => {
    const c = congelarMonto([], SIN_FERIADOS, criterio());
    expect(c.monto_pactado).toBeNull();
    expect(c.tarifa_id).toBeNull();
  });
});
