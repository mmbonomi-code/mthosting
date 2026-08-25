import { describe, expect, it } from "vitest";
import { diasSinLimpiar, tareaPeriodicaVencida } from "./diasSinLimpiar";

describe("diasSinLimpiar", () => {
  it("cuenta los días entre la última limpieza y la referencia", () => {
    expect(diasSinLimpiar("2026-08-10", "2026-08-24")).toBe(14);
  });

  it("nunca limpiado da null, no un número gigante", () => {
    expect(diasSinLimpiar(null, "2026-08-24")).toBeNull();
  });

  it("limpiado hoy mismo da cero", () => {
    expect(diasSinLimpiar("2026-08-24", "2026-08-24")).toBe(0);
  });
});

describe("tareaPeriodicaVencida", () => {
  it("vencida si pasaron al menos los días de la frecuencia", () => {
    expect(tareaPeriodicaVencida(18, 15)).toBe(true);
    expect(tareaPeriodicaVencida(15, 15)).toBe(true);
  });

  it("no vencida si todavía no llegó a la frecuencia", () => {
    expect(tareaPeriodicaVencida(12, 15)).toBe(false);
  });

  it("nunca hecha cuenta como vencida", () => {
    expect(tareaPeriodicaVencida(null, 15)).toBe(true);
  });
});
