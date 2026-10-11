import { describe, expect, it } from "vitest";
import { firmaAlerta } from "./alertas";
import { alertasAbiertas, corteDeAlertas, pideArreglo } from "./bandeja";

const CINCO = { limpieza: 5, veracidad: 5, checkin: 5, comunicacion: 5, ubicacion: 5, precio: 5 };
const r = (id: string, fecha_checkout: string, general: number, negativas: string[] = []) => ({
  id,
  fecha_checkout,
  puntaje_general: general,
  puntajes: { ...CINCO },
  negativas,
});

describe("corteDeAlertas", () => {
  it("30 días antes de la primera carga", () => {
    expect(corteDeAlertas("2026-10-11")).toBe("2026-09-11");
    expect(corteDeAlertas(null)).toBeNull();
  });
});

describe("alertasAbiertas", () => {
  const resenas = [
    r("vieja", "2026-08-01", 2),
    r("nueva", "2026-09-20", 3),
    r("buena", "2026-09-25", 5),
    r("queja", "2026-09-30", 4, ["Había manchas"]),
  ];

  it("solo las recientes que cumplen la regla, la más reciente primero", () => {
    const a = alertasAbiertas(resenas, new Map(), "2026-09-11");
    expect(a.map((x) => [x.resena.id, x.motivo])).toEqual([
      ["queja", "cuatro_con_queja"],
      ["nueva", "general_baja"],
    ]);
  });

  it("pidiéndolas, también las viejas", () => {
    expect(alertasAbiertas(resenas, new Map(), "2026-09-11", true).map((x) => x.resena.id)).toContain("vieja");
  });

  it("revisada con la misma firma sale; si la reseña cambió, vuelve", () => {
    const firma = firmaAlerta(resenas[1]);
    expect(alertasAbiertas(resenas, new Map([["nueva", firma]]), null).map((x) => x.resena.id)).not.toContain("nueva");
    expect(alertasAbiertas(resenas, new Map([["nueva", "otra"]]), null).map((x) => x.resena.id)).toContain("nueva");
  });
});

describe("pideArreglo", () => {
  it("mantenimiento y cosas rotas sí; suciedad no", () => {
    expect(pideArreglo("Necesita mantenimiento")).toBe(true);
    expect(pideArreglo("Calefacción: Estaba roto o no se podía usar")).toBe(true);
    expect(pideArreglo("Calefacción: Faltaba")).toBe(true);
    expect(pideArreglo("Hubo un problema con la cerradura")).toBe(true);
    expect(pideArreglo("El baño estaba sucio")).toBe(false);
  });
});
