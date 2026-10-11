import { describe, expect, it } from "vitest";
import { resolverPeriodo, ventanaTasa } from "./periodo";

const HOY = "2026-10-11";

describe("resolverPeriodo", () => {
  it("por defecto, los últimos 90 días contando hoy", () => {
    expect(resolverPeriodo({}, HOY)).toMatchObject({ clave: "90", desde: "2026-07-14", hasta: HOY });
  });

  it("atajos y rango libre", () => {
    expect(resolverPeriodo({ p: "anio" }, HOY)).toMatchObject({ desde: "2026-01-01", hasta: HOY });
    expect(resolverPeriodo({ p: "todo" }, HOY).clave).toBe("todo");
    expect(resolverPeriodo({ desde: "2026-06-01", hasta: "2026-08-31" }, HOY)).toMatchObject({
      clave: "rango",
      desde: "2026-06-01",
      hasta: "2026-08-31",
    });
  });

  it("un rango roto vuelve al de 90 días", () => {
    expect(resolverPeriodo({ desde: "2026-09-01", hasta: "2026-08-01" }, HOY).clave).toBe("90");
    expect(resolverPeriodo({ desde: "ayer", hasta: "hoy" }, HOY).clave).toBe("90");
  });
});

describe("ventanaTasa", () => {
  it("no antes de julio de 2026 y no en los últimos 14 días", () => {
    const todo = resolverPeriodo({ p: "todo" }, HOY);
    expect(ventanaTasa(todo, HOY)).toEqual({ desde: "2026-07-01", hasta: "2026-09-26" });
  });

  it("un período que cae entero en los últimos 14 días no tiene tasa", () => {
    const corto = resolverPeriodo({ desde: "2026-10-01", hasta: "2026-10-10" }, HOY);
    expect(ventanaTasa(corto, HOY)).toBeNull();
  });
});
