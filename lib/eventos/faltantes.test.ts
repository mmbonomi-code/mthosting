import { describe, expect, it } from "vitest";
import { faltantesDeEvento } from "./faltantes";

const base = {
  tipo: "checkin" as const,
  horaCoordinada: "15:00",
  acceso: { clase: "persona" as const },
  accesoDejado: false,
  requiereRegistro: false,
  registroHecho: false,
  requiereAviso: false,
  avisoHecho: false,
};

describe("faltantesDeEvento", () => {
  it("con todo resuelto no falta nada", () => {
    expect(faltantesDeEvento(base)).toEqual([]);
  });

  it("sin acceso definido pide coordinar", () => {
    expect(faltantesDeEvento({ ...base, acceso: null })).toEqual(["coordinar"]);
  });

  it("sin horario pide definirlo", () => {
    expect(faltantesDeEvento({ ...base, horaCoordinada: null })).toEqual([
      "definir horario",
    ]);
  });

  it("nombra la acción según el tipo de punto físico", () => {
    const casos = [
      { metodo: "sobre", esperado: "dejar sobre" },
      { metodo: "candado", esperado: "dejar candado" },
      { metodo: "llaves", esperado: "dejar llaves" },
    ];
    for (const caso of casos) {
      expect(
        faltantesDeEvento({ ...base, acceso: { clase: "punto", metodo: caso.metodo } }),
      ).toEqual([caso.esperado]);
    }
  });

  it("las valijas no piden confirmación: no hay nada que el equipo deba dejar", () => {
    expect(
      faltantesDeEvento({ ...base, acceso: { clase: "punto", metodo: "valijas" } }),
    ).toEqual([]);
  });

  it("una vez dejado el sobre, deja de faltar", () => {
    expect(
      faltantesDeEvento({
        ...base,
        acceso: { clase: "punto", metodo: "sobre" },
        accesoDejado: true,
      }),
    ).toEqual([]);
  });

  it("el self no es algo que el equipo tenga que dejar", () => {
    expect(
      faltantesDeEvento({ ...base, acceso: { clase: "punto", metodo: "self" } }),
    ).toEqual([]);
  });

  it("una persona presencial tampoco deja nada", () => {
    expect(faltantesDeEvento({ ...base, acceso: { clase: "persona" } })).toEqual([]);
  });

  it("pide registro y aviso solo si el departamento los requiere", () => {
    expect(
      faltantesDeEvento({ ...base, requiereRegistro: true, requiereAviso: true }),
    ).toEqual(["registro", "aviso seguridad"]);

    expect(
      faltantesDeEvento({
        ...base,
        requiereRegistro: true,
        registroHecho: true,
        requiereAviso: true,
        avisoHecho: true,
      }),
    ).toEqual([]);
  });

  it("en el check-out la llave la deja el huésped: no se pide confirmación", () => {
    expect(
      faltantesDeEvento({
        ...base,
        tipo: "checkout",
        acceso: { clase: "punto", metodo: "sobre" },
        accesoDejado: false,
      }),
    ).toEqual([]);
  });

  it("el check-out no pide registro ni aviso aunque el depto los requiera", () => {
    expect(
      faltantesDeEvento({
        ...base,
        tipo: "checkout",
        requiereRegistro: true,
        requiereAviso: true,
      }),
    ).toEqual([]);
  });

  it("junta todos los pendientes cuando no hay nada hecho", () => {
    expect(
      faltantesDeEvento({
        tipo: "checkin",
        horaCoordinada: null,
        acceso: null,
        accesoDejado: false,
        requiereRegistro: true,
        registroHecho: false,
        requiereAviso: true,
        avisoHecho: false,
      }),
    ).toEqual(["coordinar", "definir horario", "registro", "aviso seguridad"]);
  });
});
