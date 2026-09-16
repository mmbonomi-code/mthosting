import { describe, expect, it } from "vitest";
import { calcularVentana, corregirVentanas } from "./ventana";
import type { LimpiezaExistente, ReservaPlan } from "./planificar";

function reserva(parcial: Partial<ReservaPlan>): ReservaPlan {
  return {
    id: "r1",
    codigo_reserva: "HM1",
    depto_id: "d1",
    fecha_checkin: "2026-09-12",
    fecha_checkout: "2026-09-15",
    cancelada: false,
    descartada: false,
    ...parcial,
  };
}

function limpieza(parcial: Partial<LimpiezaExistente>): LimpiezaExistente {
  return {
    id: "l1",
    depto_id: "d1",
    reserva_id: "r1",
    rol_reserva: "salida",
    fecha: "2026-09-15",
    estado: "pendiente",
    urgente: false,
    prox_checkin: null,
    fecha_manual: false,
    cancelada_manual: false,
    asignado_a: null,
    ...parcial,
  };
}

describe("calcularVentana", () => {
  it("urgente si alguien entra ese mismo día", () => {
    expect(calcularVentana("2026-09-16", ["2026-09-20", "2026-09-16"])).toEqual({
      urgente: true,
      prox_checkin: "2026-09-16T00:00:00",
    });
  });

  it("toma el próximo check-in, no uno anterior", () => {
    expect(calcularVentana("2026-09-16", ["2026-09-10", "2026-09-18", null])).toEqual({
      urgente: false,
      prox_checkin: "2026-09-18T00:00:00",
    });
  });

  it("sin nadie por llegar", () => {
    expect(calcularVentana("2026-09-16", [])).toEqual({ urgente: false, prox_checkin: null });
  });
});

describe("corregirVentanas", () => {
  const anterior = reserva({ id: "r1" });

  it("una reserva nueva que entra el día de la salida marca la limpieza del anterior", () => {
    const nueva = reserva({ id: "r2", fecha_checkin: "2026-09-15", fecha_checkout: "2026-09-18" });
    const cambios = corregirVentanas(
      [limpieza({ prox_checkin: "2026-09-25T00:00:00" })],
      [anterior, nueva],
    );
    expect(cambios).toEqual([
      { id: "l1", urgente: true, prox_checkin: "2026-09-15T00:00:00" },
    ]);
  });

  it("si esa reserva se cancela, la marca se va", () => {
    const cancelada = reserva({ id: "r2", fecha_checkin: "2026-09-15", cancelada: true });
    const cambios = corregirVentanas(
      [limpieza({ urgente: true, prox_checkin: "2026-09-15T00:00:00" })],
      [anterior, cancelada],
    );
    expect(cambios).toEqual([{ id: "l1", urgente: false, prox_checkin: null }]);
  });

  it("lo que ya está bien no genera cambios", () => {
    const nueva = reserva({ id: "r2", fecha_checkin: "2026-09-15" });
    expect(
      corregirVentanas(
        [limpieza({ urgente: true, prox_checkin: "2026-09-15T00:00:00" })],
        [anterior, nueva],
      ),
    ).toEqual([]);
  });

  it("no toca repasos, canceladas ni otros deptos", () => {
    const nueva = reserva({ id: "r2", fecha_checkin: "2026-09-15" });
    const otroDepto = reserva({ id: "r3", depto_id: "d2", fecha_checkin: "2026-09-15" });
    expect(
      corregirVentanas(
        [
          limpieza({ id: "repaso", rol_reserva: "entrada" }),
          limpieza({ id: "cancelada", estado: "cancelada" }),
          limpieza({ id: "otro", depto_id: "d3" }),
        ],
        [anterior, nueva, otroDepto],
      ),
    ).toEqual([]);
  });
});
