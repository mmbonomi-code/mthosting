import { describe, expect, it } from "vitest";
import { estadoAlQuitarResponsable } from "./asignar";

describe("quitar el responsable", () => {
  it("deja la limpieza pendiente, lista para otra persona", () => {
    expect(estadoAlQuitarResponsable("asignada")).toBe("pendiente");
    expect(estadoAlQuitarResponsable("en_curso")).toBe("pendiente");
    expect(estadoAlQuitarResponsable("hecha")).toBe("pendiente");
  });

  it("NO revive una limpieza cancelada", () => {
    expect(estadoAlQuitarResponsable("cancelada")).toBe("cancelada");
  });
});
