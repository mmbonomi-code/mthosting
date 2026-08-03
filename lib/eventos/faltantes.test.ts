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

  it("sin acceso definido pide definirlo", () => {
    expect(faltantesDeEvento({ ...base, acceso: null })).toEqual([
      "falta definir cómo entra",
    ]);
  });

  it("sin horario pide el horario", () => {
    expect(faltantesDeEvento({ ...base, horaCoordinada: null })).toEqual([
      "falta el horario",
    ]);
  });

  it("nombra el punto físico que falta dejar", () => {
    expect(
      faltantesDeEvento({
        ...base,
        acceso: { clase: "punto", metodo: "sobre", ubicacion: "Talcahuano" },
      }),
    ).toEqual(["falta dejar el sobre Talcahuano"]);

    expect(
      faltantesDeEvento({
        ...base,
        acceso: { clase: "punto", metodo: "candado", ubicacion: "Kennedy 3", identificador: "#2906" },
      }),
    ).toEqual(["falta dejar el candado Kennedy 3 #2906"]);
  });

  it("una vez dejado el sobre, deja de faltar", () => {
    expect(
      faltantesDeEvento({
        ...base,
        acceso: { clase: "punto", metodo: "sobre", ubicacion: "Talcahuano" },
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
    ).toEqual(["falta el registro", "falta el aviso a seguridad"]);

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
        acceso: { clase: "punto", metodo: "sobre", ubicacion: "Talcahuano" },
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
    ).toEqual([
      "falta definir cómo entra",
      "falta el horario",
      "falta el registro",
      "falta el aviso a seguridad",
    ]);
  });
});
