import { describe, expect, it } from "vitest";
import { textoDeCargas, type UltimasCargas } from "./cargas";

const HOY = "2026-10-22";

const cargas = (c: Partial<UltimasCargas>): UltimasCargas => ({
  cobros: { fecha: "2026-10-17" },
  programados: { fecha: "2026-10-17" },
  ...c,
});

describe("textoDeCargas", () => {
  it("cuando los dos se subieron el mismo día lo dice una sola vez", () => {
    expect(textoDeCargas(cargas({}), HOY)).toBe(
      "Cobros y próximos cobros importados el 17/10/2026.",
    );
  });

  it("si se subieron en días distintos muestra los dos", () => {
    const t = textoDeCargas(cargas({ programados: { fecha: "2026-10-20" } }), HOY);
    expect(t).toBe("Cobros importados el 17/10/2026 · próximos cobros, el 20/10/2026.");
  });

  it("lo de hoy se dice hoy, no con la fecha", () => {
    const t = textoDeCargas(
      cargas({ cobros: { fecha: HOY }, programados: { fecha: HOY } }),
      HOY,
    );
    expect(t).toBe("Cobros y próximos cobros importados hoy.");
  });

  it("en una pantalla que no usa los programados, no los nombra", () => {
    const t = textoDeCargas(cargas({}), HOY, false);
    expect(t).toBe("Cobros importados el 17/10/2026.");
  });

  it("sin ninguna carga lo dice, en vez de mostrar una fecha vacía", () => {
    expect(textoDeCargas({ cobros: null, programados: null }, HOY)).toBe(
      "Todavía no se importó ningún cobro.",
    );
  });

  it("con programados pero sin cobros avisa que faltan los cobros", () => {
    const t = textoDeCargas({ cobros: null, programados: { fecha: "2026-10-17" } }, HOY);
    expect(t).toContain("Todavía no se importó ningún cobro");
  });

  it("si la pantalla no usa programados y no hay cobros, no promete nada", () => {
    expect(
      textoDeCargas({ cobros: null, programados: { fecha: "2026-10-17" } }, HOY, false),
    ).toBe("Todavía no se importó ningún cobro.");
  });
});
