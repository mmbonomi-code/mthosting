import { describe, expect, it } from "vitest";
import { rolPuedeVerMisLimpiezas } from "./permisos";

describe("quién ve Mis limpiezas", () => {
  it("admin, manager, gobernanta y limpieza pueden", () => {
    expect(rolPuedeVerMisLimpiezas("admin")).toBe(true);
    expect(rolPuedeVerMisLimpiezas("manager")).toBe(true);
    expect(rolPuedeVerMisLimpiezas("gobernanta")).toBe(true);
    expect(rolPuedeVerMisLimpiezas("limpieza")).toBe(true);
  });

  it("coordinador y propietario no: no es su pantalla", () => {
    expect(rolPuedeVerMisLimpiezas("coordinador")).toBe(false);
    expect(rolPuedeVerMisLimpiezas("propietario")).toBe(false);
  });

  it("sin rol tampoco", () => {
    expect(rolPuedeVerMisLimpiezas(null)).toBe(false);
  });
});
