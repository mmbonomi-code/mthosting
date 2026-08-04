import { describe, expect, it } from "vitest";
import { cargaPorPersona, diasEntre, semaforoDeLimpieza } from "./semaforo";

const HOY = "2026-08-03";

describe("diasEntre", () => {
  it("cuenta días calendario, sin zonas horarias de por medio", () => {
    expect(diasEntre("2026-08-03", "2026-08-04")).toBe(1);
    expect(diasEntre("2026-08-31", "2026-09-01")).toBe(1);
    expect(diasEntre("2026-08-03", "2026-08-03")).toBe(0);
    expect(diasEntre("2026-08-03", "2026-08-01")).toBe(-2);
  });
});

describe("semaforoDeLimpieza", () => {
  const sinResponsable = (fecha: string) =>
    semaforoDeLimpieza({ fecha, hoy: HOY, tieneResponsable: false });

  it("una limpieza asignada no grita", () => {
    expect(
      semaforoDeLimpieza({ fecha: "2026-08-04", hoy: HOY, tieneResponsable: true }),
    ).toBe("asignada");
  });

  it("sin responsable para hoy o mañana: rojo", () => {
    expect(sinResponsable("2026-08-03")).toBe("rojo");
    expect(sinResponsable("2026-08-04")).toBe("rojo");
  });

  it("a dos o tres días: ámbar", () => {
    expect(sinResponsable("2026-08-05")).toBe("ambar");
    expect(sinResponsable("2026-08-06")).toBe("ambar");
  });

  it("más adelante: gris", () => {
    expect(sinResponsable("2026-08-07")).toBe("gris");
    expect(sinResponsable("2026-09-01")).toBe("gris");
  });

  it("lo que ya pasó sin asignar sigue en rojo", () => {
    expect(sinResponsable("2026-08-01")).toBe("rojo");
  });
});

describe("cargaPorPersona", () => {
  const limpieza = (
    asignado_a: string | null,
    nombre: string | null,
    monto: number | null,
  ) => ({
    asignado_a,
    monto_pactado: monto,
    moneda: monto === null ? null : "ARS",
    responsable: nombre ? { nombre } : null,
  });

  it("suma cantidad y plata por persona", () => {
    const carga = cargaPorPersona([
      limpieza("p1", "Ludmila", 10000),
      limpieza("p1", "Ludmila", 5000),
      limpieza("p2", "Patricia", 20000),
    ]);
    expect(carga).toEqual([
      { personaId: "p1", nombre: "Ludmila", cantidad: 2, monto: 15000, moneda: "ARS" },
      { personaId: "p2", nombre: "Patricia", cantidad: 1, monto: 20000, moneda: "ARS" },
    ]);
  });

  it("ordena de más cargada a menos", () => {
    const carga = cargaPorPersona([
      limpieza("p2", "Patricia", 1000),
      limpieza("p1", "Ludmila", 1000),
      limpieza("p1", "Ludmila", 1000),
    ]);
    expect(carga.map((c) => c.nombre)).toEqual(["Ludmila", "Patricia"]);
  });

  it("las limpiezas sin asignar no entran en la cuenta", () => {
    expect(cargaPorPersona([limpieza(null, null, 5000)])).toEqual([]);
  });

  it("una limpieza sin monto cuenta igual, sumando cero", () => {
    const carga = cargaPorPersona([
      limpieza("p1", "Ludmila", null),
      limpieza("p1", "Ludmila", 8000),
    ]);
    expect(carga[0]).toMatchObject({ cantidad: 2, monto: 8000, moneda: "ARS" });
  });
});
