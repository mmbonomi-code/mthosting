import { describe, expect, it } from "vitest";
import { firmaAlerta, motivoAlerta, type DatosAlerta } from "./alertas";

const CINCO = { limpieza: 5, veracidad: 5, checkin: 5, comunicacion: 5, ubicacion: 5, precio: 5 };

const datos = (cambios: Partial<DatosAlerta> = {}): DatosAlerta => ({
  puntaje_general: 5,
  puntajes: { ...CINCO },
  negativas: [],
  ...cambios,
});

describe("motivoAlerta", () => {
  it("general de 3 o menos", () => {
    expect(motivoAlerta(datos({ puntaje_general: 3 }))).toBe("general_baja");
    expect(motivoAlerta(datos({ puntaje_general: 1 }))).toBe("general_baja");
  });

  it("alguna categoría de 2 o menos", () => {
    expect(motivoAlerta(datos({ puntajes: { ...CINCO, checkin: 2 } }))).toBe("categoria_baja");
    expect(motivoAlerta(datos({ puntajes: { ...CINCO, checkin: 3 } }))).toBeNull();
  });

  it("4 estrellas con alguna queja", () => {
    expect(motivoAlerta(datos({ puntaje_general: 4, negativas: ["Había manchas"] }))).toBe(
      "cuatro_con_queja",
    );
    expect(motivoAlerta(datos({ puntaje_general: 4 }))).toBeNull();
  });

  it("5 estrellas con una queja no alerta", () => {
    expect(motivoAlerta(datos({ negativas: ["Es ruidoso"] }))).toBeNull();
  });

  it("una categoría vacía no cuenta como baja", () => {
    expect(motivoAlerta(datos({ puntajes: { ...CINCO, precio: null } }))).toBeNull();
  });
});

describe("firmaAlerta", () => {
  it("cambia si cambia un puntaje o una queja, no por el orden", () => {
    const a = firmaAlerta(datos({ negativas: ["B", "A"] }));
    expect(firmaAlerta(datos({ negativas: ["A", "B"] }))).toBe(a);
    expect(firmaAlerta(datos({ negativas: ["A"] }))).not.toBe(a);
    expect(firmaAlerta(datos({ negativas: ["B", "A"], puntajes: { ...CINCO, limpieza: 4 } }))).not.toBe(a);
  });
});
