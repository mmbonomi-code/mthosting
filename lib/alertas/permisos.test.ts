import { describe, expect, it } from "vitest";
import { rolPuedeVerAlertas } from "./permisos";

describe("quién ve el panel de alertas", () => {
  it("admin, manager y coordinador pueden", () => {
    expect(rolPuedeVerAlertas("admin")).toBe(true);
    expect(rolPuedeVerAlertas("manager")).toBe(true);
    expect(rolPuedeVerAlertas("coordinador")).toBe(true);
  });

  it("gobernanta, limpieza y propietario no", () => {
    for (const rol of ["gobernanta", "limpieza", "propietario"] as const) {
      expect(rolPuedeVerAlertas(rol), rol).toBe(false);
    }
  });

  it("sin rol tampoco", () => {
    expect(rolPuedeVerAlertas(null)).toBe(false);
  });
});
