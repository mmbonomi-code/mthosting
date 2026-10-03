import { describe, expect, it } from "vitest";
import { filasFueraDeGestion } from "./gestion";

type F = {
  fecha: string;
  fecha_inicio: string | null;
  es_payout: boolean;
  grupo_payout: number | null;
  depto: string | null;
};

const payout = (grupo: number, fecha = "2026-01-01"): F => ({
  fecha,
  fecha_inicio: null,
  es_payout: true,
  grupo_payout: grupo,
  depto: null,
});
const reserva = (grupo: number | null, inicio: string | null, depto = "honduras", fecha = "2026-01-02"): F => ({
  fecha,
  fecha_inicio: inicio,
  es_payout: false,
  grupo_payout: grupo,
  depto,
});

const desde = new Map([["honduras", "2026-03-13"]]);
const correr = (filas: F[], d = desde) => [...filasFueraDeGestion(filas, (f) => f.depto, d)].sort();

describe("filasFueraDeGestion", () => {
  it("saca la reserva anterior a la fecha de alta y su payout", () => {
    // El caso real de HONDURAS 1: un payout a la propietaria con una sola reserva.
    expect(correr([payout(1), reserva(1, "2025-12-31")])).toEqual([0, 1]);
  });

  it("deja la reserva que empieza justo el día del alta", () => {
    expect(correr([payout(1), reserva(1, "2026-03-13")])).toEqual([]);
  });

  it("si el grupo mezcla una reserva nuestra, el payout se queda", () => {
    expect(
      correr([payout(1), reserva(1, "2026-02-13"), reserva(1, "2026-03-20")]),
    ).toEqual([1]);
  });

  it("la línea de coanfitrión sigue a su reserva", () => {
    expect(
      correr([payout(1), reserva(1, "2026-02-13"), reserva(1, "2026-02-13")]),
    ).toEqual([0, 1, 2]);
  });

  it("sin fecha de inicio mira la fecha del movimiento", () => {
    expect(correr([payout(1), reserva(1, null, "honduras", "2026-03-01")])).toEqual([0, 1]);
    expect(correr([payout(1), reserva(1, null, "honduras", "2026-04-01")])).toEqual([]);
  });

  it("no toca deptos sin fecha de alta ni filas sin mapear", () => {
    expect(
      correr([payout(1), reserva(1, "2025-01-01", "beruti"), reserva(1, "2025-01-01", null as never)]),
    ).toEqual([]);
  });

  it("un payout sin detalle no se saca", () => {
    expect(correr([payout(1), payout(2), reserva(2, "2026-01-01")])).toEqual([1, 2]);
  });

  it("filas antes del primer payout se evalúan solas", () => {
    expect(correr([reserva(null, "2026-01-01"), payout(1), reserva(1, "2026-05-01")])).toEqual([0]);
  });
});
