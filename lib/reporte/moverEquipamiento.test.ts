import { describe, expect, it } from "vitest";
import { fechasNuevasDelEquipo } from "./moverEquipamiento";

const ANTES = { checkin: "2026-09-30", checkout: "2026-10-05" };

describe("fechasNuevasDelEquipo", () => {
  it("una cuna para toda la estadía se mueve entera con la reserva", () => {
    expect(
      fechasNuevasDelEquipo(
        { fecha_desde: "2026-09-30", fecha_hasta: "2026-10-05" },
        ANTES,
        { checkin: "2026-10-01", checkout: "2026-10-07" },
      ),
    ).toEqual({ fecha_desde: "2026-10-01", fecha_hasta: "2026-10-07" });
  });

  it("si solo cambia el check-out, solo se mueve el retiro", () => {
    expect(
      fechasNuevasDelEquipo(
        { fecha_desde: "2026-09-30", fecha_hasta: "2026-10-05" },
        ANTES,
        { checkin: "2026-09-30", checkout: "2026-10-06" },
      ),
    ).toEqual({ fecha_desde: "2026-09-30", fecha_hasta: "2026-10-06" });
  });

  it("una punta puesta a mano se respeta: se mueve solo la que coincidía", () => {
    // Cuna pedida desde el 02/10 (a mano) hasta el check-out.
    expect(
      fechasNuevasDelEquipo(
        { fecha_desde: "2026-10-02", fecha_hasta: "2026-10-05" },
        ANTES,
        { checkin: "2026-09-29", checkout: "2026-10-06" },
      ),
    ).toEqual({ fecha_desde: "2026-10-02", fecha_hasta: "2026-10-06" });
  });

  it("si ninguna punta coincidía, no se toca", () => {
    expect(
      fechasNuevasDelEquipo(
        { fecha_desde: "2026-10-01", fecha_hasta: "2026-10-03" },
        ANTES,
        { checkin: "2026-10-10", checkout: "2026-10-15" },
      ),
    ).toBeNull();
  });

  it("si la reserva no cambió, no hay nada que mover", () => {
    expect(
      fechasNuevasDelEquipo({ fecha_desde: "2026-09-30", fecha_hasta: "2026-10-05" }, ANTES, ANTES),
    ).toBeNull();
  });

  it("si mover una punta la dejaría al revés, no se mueve (lo decide una persona)", () => {
    // Cuna para los primeros días; la estadía ahora arranca después de que terminaba.
    expect(
      fechasNuevasDelEquipo(
        { fecha_desde: "2026-09-30", fecha_hasta: "2026-10-01" },
        ANTES,
        { checkin: "2026-10-03", checkout: "2026-10-08" },
      ),
    ).toBeNull();
  });
});
