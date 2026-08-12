import { describe, expect, it } from "vitest";
import {
  airbnbPisaLoEditado,
  calcularNoches,
  codigoDeReservaDirecta,
  esCodigoDirecto,
  validarReserva,
  type DatosReserva,
} from "./validar";

function datos(p: Partial<DatosReserva> = {}): DatosReserva {
  return {
    origen: "directa",
    codigo_reserva: "",
    depto_id: "d1",
    fecha_checkin: "2026-08-10",
    fecha_checkout: "2026-08-12",
    huesped_nombre: "Ana Ferreira",
    adultos: 2,
    ...p,
  };
}

describe("calcularNoches", () => {
  it("del 10 al 12 son 2 noches: el día de salida no se duerme", () => {
    expect(calcularNoches("2026-08-10", "2026-08-12")).toBe(2);
  });

  it("cruza el fin de mes sin equivocarse", () => {
    expect(calcularNoches("2026-08-30", "2026-09-02")).toBe(3);
  });

  it("sin alguna de las dos fechas no hay noches", () => {
    expect(calcularNoches(null, "2026-08-12")).toBeNull();
    expect(calcularNoches("2026-08-10", null)).toBeNull();
  });

  it("fechas al revés o iguales no dan cero ni negativo: dan null", () => {
    expect(calcularNoches("2026-08-12", "2026-08-10")).toBeNull();
    expect(calcularNoches("2026-08-10", "2026-08-10")).toBeNull();
  });
});

describe("validarReserva", () => {
  it("una reserva completa no tiene errores", () => {
    expect(validarReserva(datos())).toEqual([]);
  });

  it("pide el departamento y las fechas", () => {
    const errores = validarReserva(
      datos({ depto_id: null, fecha_checkin: null, fecha_checkout: null }),
    );
    expect(errores).toHaveLength(3);
    expect(errores[0]).toMatch(/departamento/i);
  });

  it("la salida tiene que ser posterior a la entrada", () => {
    expect(
      validarReserva(datos({ fecha_checkin: "2026-08-12", fecha_checkout: "2026-08-10" })),
    ).toContainEqual(expect.stringMatching(/posterior/i));

    expect(
      validarReserva(datos({ fecha_checkin: "2026-08-10", fecha_checkout: "2026-08-10" })),
    ).toContainEqual(expect.stringMatching(/posterior/i));
  });

  it("una de Airbnb sin código no se puede guardar", () => {
    expect(validarReserva(datos({ origen: "airbnb", codigo_reserva: "" }))).toContainEqual(
      expect.stringMatching(/código de Airbnb/i),
    );
    expect(validarReserva(datos({ origen: "airbnb", codigo_reserva: "  " }))).toHaveLength(1);
  });

  it("una directa no necesita código: se lo generamos nosotros", () => {
    expect(validarReserva(datos({ origen: "directa", codigo_reserva: "" }))).toEqual([]);
  });

  it("no acepta una cantidad de personas negativa", () => {
    expect(validarReserva(datos({ adultos: -1 }))).toContainEqual(
      expect.stringMatching(/negativa/i),
    );
  });

  it("sin nombre del huésped se puede guardar igual", () => {
    // Una reserva del calendario entra sin nombre y hay que poder anotarla.
    expect(validarReserva(datos({ huesped_nombre: null }))).toEqual([]);
  });
});

describe("codigoDeReservaDirecta", () => {
  it("lleva prefijo para no confundirse con uno de Airbnb", () => {
    expect(codigoDeReservaDirecta("a1b2c3d4")).toBe("DIR-A1B2C3D4");
  });

  it("descarta la puntuación de un uuid y se queda con 8", () => {
    expect(codigoDeReservaDirecta("3f2a-9b81-cc")).toBe("DIR-3F2A9B81");
  });

  it("se reconoce después", () => {
    expect(esCodigoDirecto(codigoDeReservaDirecta("a1b2c3d4"))).toBe(true);
    expect(esCodigoDirecto("HMCNXQKHP5")).toBe(false);
  });
});

describe("airbnbPisaLoEditado", () => {
  it("lo que vino del CSV o del calendario lo pisa la próxima importación", () => {
    expect(airbnbPisaLoEditado("csv", "HMCNXQKHP5")).toBe(true);
    expect(airbnbPisaLoEditado("ical", "HMCNXQKHP5")).toBe(true);
  });

  it("una manual con código real de Airbnb también se va a fusionar", () => {
    expect(airbnbPisaLoEditado("manual", "HMCNXQKHP5")).toBe(true);
  });

  it("una directa no la pisa nadie: Airbnb no sabe que existe", () => {
    expect(airbnbPisaLoEditado("manual", "DIR-A1B2C3D4")).toBe(false);
  });
});
