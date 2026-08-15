import { describe, expect, it } from "vitest";
import { rolPuedeEditarReservas } from "./permisos";

describe("quién carga y edita reservas", () => {
  it("coordinación puede, desde el 14/08/2026", () => {
    // Es quien más habla con el huésped: si tiene que pedirle el cambio a
    // otro, la reserva queda desactualizada más tiempo.
    expect(rolPuedeEditarReservas("coordinador")).toBe(true);
  });

  it("manager y administración también", () => {
    expect(rolPuedeEditarReservas("manager")).toBe(true);
    expect(rolPuedeEditarReservas("admin")).toBe(true);
  });

  it("gobernanta, limpieza y propietario no", () => {
    for (const rol of ["gobernanta", "limpieza", "propietario"] as const) {
      expect(rolPuedeEditarReservas(rol), rol).toBe(false);
    }
  });

  it("sin rol tampoco", () => {
    // Acá no vale la excepción del primer uso: para cargar una reserva ya
    // tiene que existir la ficha de quien la carga.
    expect(rolPuedeEditarReservas(null)).toBe(false);
  });
});
