import { describe, expect, it } from "vitest";
import { describirAcceso, esAccesoPresencial } from "./etiquetas";

const punto = (
  metodo: string,
  ubicacion: string | null = null,
  identificador: string | null = null,
) => ({ metodo, ubicacion, identificador });

describe("describirAcceso", () => {
  it("un punto físico dice el método y dónde está", () => {
    expect(describirAcceso(punto("sobre", "Esmeralda"), null)).toBe("Sobre - Esmeralda");
    expect(describirAcceso(punto("candado", "Kennedy 1", "#2906"), null)).toBe(
      "Candado - Kennedy 1 #2906",
    );
  });

  it("un presencial dice solo el nombre: la palabra sobra", () => {
    // El nombre ya deja claro que va una persona.
    expect(describirAcceso(punto("presencial", "Diego"), null)).toBe("Diego");
    expect(describirAcceso(punto("presencial", "Vecina Maguie"), null)).toBe(
      "Vecina Maguie",
    );
  });

  it("un presencial sin nombre sí dice Presencial", () => {
    expect(describirAcceso(punto("presencial"), null)).toBe("Presencial");
  });

  it("una persona suelta también va sola", () => {
    expect(describirAcceso(null, { nombre: "Marcos" })).toBe("Marcos");
  });

  it("sin acceso definido no inventa texto", () => {
    expect(describirAcceso(null, null)).toBeNull();
  });

  it("el punto manda sobre la persona si están los dos", () => {
    expect(describirAcceso(punto("sobre", "Esmeralda"), { nombre: "Marcos" })).toBe(
      "Sobre - Esmeralda",
    );
  });

  it("un método sin etiqueta conocida se muestra tal cual", () => {
    expect(describirAcceso(punto("self"), null)).toBe("Self");
  });
});

describe("esAccesoPresencial", () => {
  it("un punto presencial ocupa a alguien del equipo", () => {
    expect(esAccesoPresencial(punto("presencial", "Diego"), null)).toBe(true);
    expect(esAccesoPresencial(punto("presencial"), null)).toBe(true);
  });

  it("los accesos donde el huésped entra solo, no", () => {
    for (const metodo of ["sobre", "candado", "valijas", "self", "llaves"]) {
      expect(esAccesoPresencial(punto(metodo, "Esmeralda"), null)).toBe(false);
    }
  });

  it("una persona suelta de las coordinaciones viejas también es presencial", () => {
    expect(esAccesoPresencial(null, { nombre: "Marcos" })).toBe(true);
  });

  it("sin acceso definido no es presencial", () => {
    expect(esAccesoPresencial(null, null)).toBe(false);
  });

  it("el punto manda sobre la persona si están los dos", () => {
    expect(esAccesoPresencial(punto("sobre", "Esmeralda"), { nombre: "Marcos" })).toBe(
      false,
    );
  });
});
