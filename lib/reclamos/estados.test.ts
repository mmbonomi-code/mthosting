import { describe, expect, it } from "vitest";
import {
  camposAlCambiar,
  ESTADOS_FINALES,
  faltaParaPresentar,
  pareceUrlDeAirbnb,
  puedeIr,
  transicionesDe,
} from "./estados";
import type { EstadoReclamo } from "./plazos";

const AHORA = "2026-08-11T15:30:00.000Z";

describe("transiciones", () => {
  it("el camino normal", () => {
    expect(puedeIr("borrador", "por_presentar")).toBe(true);
    expect(puedeIr("por_presentar", "presentado")).toBe(true);
    expect(puedeIr("presentado", "escalado")).toBe(true);
    expect(puedeIr("escalado", "cobrado")).toBe(true);
  });

  it("desde presentado se puede cobrar o rechazar sin escalar", () => {
    expect(puedeIr("presentado", "cobrado")).toBe(true);
    expect(puedeIr("presentado", "rechazado")).toBe(true);
  });

  it("un borrador se puede presentar directo, sin pasar por por_presentar", () => {
    expect(puedeIr("borrador", "presentado")).toBe(true);
  });

  it("descartar solo mientras no se haya presentado", () => {
    expect(puedeIr("borrador", "descartado")).toBe(true);
    expect(puedeIr("por_presentar", "descartado")).toBe(true);
    expect(puedeIr("presentado", "descartado")).toBe(false);
    expect(puedeIr("escalado", "descartado")).toBe(false);
  });

  it("no se vuelve para atrás", () => {
    expect(puedeIr("presentado", "borrador")).toBe(false);
    expect(puedeIr("escalado", "presentado")).toBe(false);
    expect(puedeIr("por_presentar", "borrador")).toBe(false);
  });

  it("no se escala algo que todavía no se presentó", () => {
    expect(puedeIr("borrador", "escalado")).toBe(false);
    expect(puedeIr("por_presentar", "escalado")).toBe(false);
  });

  it("no se cobra algo que no se presentó", () => {
    expect(puedeIr("borrador", "cobrado")).toBe(false);
    expect(puedeIr("por_presentar", "cobrado")).toBe(false);
  });

  it("de los estados finales no sale nada", () => {
    for (const estado of ESTADOS_FINALES) {
      expect(transicionesDe(estado)).toEqual([]);
    }
  });

  it("ningún estado puede ir a sí mismo", () => {
    const todos: EstadoReclamo[] = [
      "borrador",
      "por_presentar",
      "presentado",
      "escalado",
      "cobrado",
      "rechazado",
      "descartado",
    ];
    for (const estado of todos) expect(puedeIr(estado, estado)).toBe(false);
  });
});

describe("faltaParaPresentar", () => {
  it("con motivo y monto no falta nada", () => {
    expect(faltaParaPresentar({ motivo: "Rompieron la mesa", monto_reclamado: 150 })).toEqual(
      [],
    );
  });

  it("un borrador vacío avisa las dos cosas", () => {
    expect(faltaParaPresentar({ motivo: null, monto_reclamado: null })).toEqual([
      "el motivo",
      "el monto reclamado",
    ]);
  });

  it("un motivo de solo espacios no cuenta", () => {
    expect(faltaParaPresentar({ motivo: "   ", monto_reclamado: 50 })).toEqual([
      "el motivo",
    ]);
  });

  it("un monto en cero tampoco", () => {
    expect(faltaParaPresentar({ motivo: "Algo", monto_reclamado: 0 })).toEqual([
      "el monto reclamado",
    ]);
  });
});

describe("camposAlCambiar", () => {
  it("presentar deja la marca de cuándo se presentó", () => {
    expect(camposAlCambiar("presentado", AHORA)).toEqual({
      estado: "presentado",
      presentado_at: AHORA,
    });
  });

  it("escalar deja la suya, sin pisar la anterior", () => {
    expect(camposAlCambiar("escalado", AHORA)).toEqual({
      estado: "escalado",
      escalado_at: AHORA,
    });
  });

  it("cobrar guarda el monto, que puede ser menor al reclamado", () => {
    expect(camposAlCambiar("cobrado", AHORA, 80)).toEqual({
      estado: "cobrado",
      resuelto_at: AHORA,
      monto_cobrado: 80,
    });
  });

  it("rechazado es cobrar cero, escrito", () => {
    expect(camposAlCambiar("rechazado", AHORA)).toEqual({
      estado: "rechazado",
      resuelto_at: AHORA,
      monto_cobrado: 0,
    });
  });

  it("descartar no toca ninguna fecha", () => {
    expect(camposAlCambiar("descartado", AHORA)).toEqual({ estado: "descartado" });
  });
});

describe("pareceUrlDeAirbnb", () => {
  it("acepta las formas reales del link de un caso", () => {
    expect(pareceUrlDeAirbnb("https://www.airbnb.com.ar/resolutions/123")).toBe(true);
    expect(pareceUrlDeAirbnb("https://airbnb.com/resolutions/123")).toBe(true);
    expect(pareceUrlDeAirbnb("https://es.airbnb.com/help/article/279")).toBe(true);
  });

  it("avisa si no es de Airbnb", () => {
    expect(pareceUrlDeAirbnb("https://booking.com/algo")).toBe(false);
    expect(pareceUrlDeAirbnb("cualquier cosa")).toBe(false);
  });

  it("vacío no molesta: el link es opcional", () => {
    expect(pareceUrlDeAirbnb(null)).toBe(true);
    expect(pareceUrlDeAirbnb("")).toBe(true);
    expect(pareceUrlDeAirbnb("   ")).toBe(true);
  });
});
