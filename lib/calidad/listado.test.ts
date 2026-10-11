import { describe, expect, it } from "vitest";
import { leerListado, normalizarNombre } from "./listado";

const DEPTOS = [
  { id: "d-talc33", codigo: "ED TALC 33" },
  { id: "d-marcelo1", codigo: "MARCELO T 1" },
  { id: "d-aguero", codigo: "AGÜERO 2" },
  { id: "d-busta", codigo: "BUSTAMANTE 2" },
];
const PERSONAS = [
  { id: "p-emily", nombre: "EMILY" },
  { id: "p-lore", nombre: "Lore" },
];
const ENC = ["FECHA", "DEPTO", "RESP 1"];

describe("normalizarNombre", () => {
  it("saca puntos, tildes y espacios de más", () => {
    expect(normalizarNombre("Marcelo T.  1")).toBe("MARCELO T 1");
    expect(normalizarNombre("AGÜERO 2")).toBe("AGUERO 2");
  });
});

describe("leerListado", () => {
  it("fechas en los dos formatos y equivalencias de nombre", () => {
    const { cargar, descartadas } = leerListado(
      [
        ENC,
        ["2026-05-29", "ED TALC 10", "EMILY"],
        ["25/08/2026", "MARCELO T. 1", "LORE"],
        ["2026-06-02", "Aguero 2", "emily"],
      ],
      DEPTOS,
      PERSONAS,
    );
    expect(descartadas).toEqual([]);
    expect(cargar).toEqual([
      { fila: 2, fecha: "2026-05-29", deptoId: "d-talc33", personaId: "p-emily" },
      { fila: 3, fecha: "2026-08-25", deptoId: "d-marcelo1", personaId: "p-lore" },
      { fila: 4, fecha: "2026-06-02", deptoId: "d-aguero", personaId: "p-emily" },
    ]);
  });

  it("persona fuera de Personal, depto desconocido o fecha mala: se informa", () => {
    const { cargar, descartadas } = leerListado(
      [ENC, ["2026-06-01", "MARCELO T 1", "ROCIO"], ["2026-06-01", "NO EXISTE", "EMILY"], ["ayer", "MARCELO T 1", "EMILY"]],
      DEPTOS,
      PERSONAS,
    );
    expect(cargar).toEqual([]);
    expect(descartadas.map((d) => d.fila)).toEqual([2, 3, 4]);
  });

  it("mismo día y depto con dos personas: no se elige ninguna", () => {
    const { cargar, descartadas } = leerListado(
      [ENC, ["2026-06-08", "BUSTAMANTE 2", "EMILY"], ["2026-06-08", "BUSTAMANTE 2", "LORE"]],
      DEPTOS,
      PERSONAS,
    );
    expect(cargar).toEqual([]);
    expect(descartadas).toHaveLength(2);
  });

  it("la misma persona dos veces el mismo día es una sola limpieza", () => {
    const { cargar } = leerListado(
      [ENC, ["2026-06-30", "BUSTAMANTE 2", "EMILY"], ["2026-06-30", "BUSTAMANTE 2", "EMILY"]],
      DEPTOS,
      PERSONAS,
    );
    expect(cargar).toHaveLength(1);
  });

  it("sin las columnas esperadas no es el listado", () => {
    expect(() => leerListado([["ID reseña", "Anuncio"]], DEPTOS, PERSONAS)).toThrow();
  });
});
