import { describe, expect, it } from "vitest";
import { rolPuedeGestionarFotos, rolPuedeVerMisLimpiezas } from "./permisos";

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

describe("quién ve y carga fotos de cualquier limpieza", () => {
  it("coordinación puede: es lo que pide la spec de Fase 2", () => {
    expect(rolPuedeGestionarFotos("coordinador")).toBe(true);
  });

  it("admin, manager y gobernanta también", () => {
    expect(rolPuedeGestionarFotos("admin")).toBe(true);
    expect(rolPuedeGestionarFotos("manager")).toBe(true);
    expect(rolPuedeGestionarFotos("gobernanta")).toBe(true);
  });

  it("limpieza NO: sus fotos van por su propia pantalla, las ajenas no las ve", () => {
    expect(rolPuedeGestionarFotos("limpieza")).toBe(false);
  });

  it("propietario tampoco, ni nadie sin rol", () => {
    expect(rolPuedeGestionarFotos("propietario")).toBe(false);
    expect(rolPuedeGestionarFotos(null)).toBe(false);
  });
});
