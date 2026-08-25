import { describe, expect, it } from "vitest";
import { calcularQueLlevar } from "./quellevar";

describe("calcularQueLlevar", () => {
  it("una cama por tipo, toallas por capacidad, pie de baño por baño", () => {
    expect(
      calcularQueLlevar({ camasKing: 0, camasQueen: 1, camasTwin: 1, capacidad: 4, cantidadBanos: 1 }),
    ).toEqual([
      { item: "Juego de sábanas queen", cantidad: 1 },
      { item: "Juego de sábanas individual", cantidad: 1 },
      { item: "Juegos de toalla", cantidad: 4 },
      { item: "Pie de baño", cantidad: 1 },
    ]);
  });

  it("varias camas del mismo tipo suman en un solo ítem", () => {
    expect(
      calcularQueLlevar({ camasKing: 2, camasQueen: 0, camasTwin: 0, capacidad: 4, cantidadBanos: 2 }),
    ).toEqual([
      { item: "Juego de sábanas king", cantidad: 2 },
      { item: "Juegos de toalla", cantidad: 4 },
      { item: "Pie de baño", cantidad: 2 },
    ]);
  });

  it("sin capacidad cargada, no inventa un número de toallas", () => {
    const items = calcularQueLlevar({ camasKing: 0, camasQueen: 1, camasTwin: 0, capacidad: null, cantidadBanos: 1 });
    expect(items.find((i) => i.item.includes("toalla"))).toBeUndefined();
  });

  it("sin baños cargados, no pide pie de baño", () => {
    const items = calcularQueLlevar({ camasKing: 0, camasQueen: 1, camasTwin: 0, capacidad: 2, cantidadBanos: 0 });
    expect(items.find((i) => i.item === "Pie de baño")).toBeUndefined();
  });
});
