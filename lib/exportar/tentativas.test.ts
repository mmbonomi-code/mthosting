import { describe, expect, it } from "vitest";
import {
  COLUMNAS_TEXTO,
  cuando,
  ENCABEZADOS_TENTATIVAS,
  filaTentativa,
  linkAirbnb,
  PRIMERA_A_COMPLETAR,
  type ReservaTentativa,
} from "./tentativas";

function reserva(parcial: Partial<ReservaTentativa> = {}): ReservaTentativa {
  return {
    codigo_reserva: "HMZK28S3CA",
    fecha_checkin: "2026-10-03",
    fecha_checkout: "2026-10-06",
    noches: 3,
    huesped_nombre: null,
    huesped_contacto: null,
    adultos: null,
    ninos: null,
    bebes: null,
    payout_monto: null,
    raw: { origen: "ical", telefono_ultimos_4: "0137" },
    depto: { codigo: "CABELLO 2" },
    cambios: null,
    ...parcial,
  };
}

const HOY = "2026-09-13";

describe("filaTentativa", () => {
  it("tiene una celda por encabezado", () => {
    expect(filaTentativa(reserva(), HOY)).toHaveLength(ENCABEZADOS_TENTATIVAS.length);
  });

  it("trae el link directo a la reserva en Airbnb", () => {
    const fila = filaTentativa(reserva(), HOY);
    expect(fila[0]).toBe("HMZK28S3CA");
    expect(fila[1]).toBe("https://www.airbnb.com/hosting/reservations/details/HMZK28S3CA");
  });

  it("los últimos 4 conservan el cero adelante", () => {
    // Por eso esa columna va como texto: como número, "0137" sería 137.
    expect(filaTentativa(reserva(), HOY)[7]).toBe("0137");
    expect(COLUMNAS_TEXTO).toContain(8);
  });

  it("las fechas van en formato argentino", () => {
    const fila = filaTentativa(reserva(), HOY);
    expect(fila[3]).toBe("03/10/2026");
    expect(fila[4]).toBe("06/10/2026");
  });

  it("lo que hay que completar sale vacío si no se sabe", () => {
    const fila = filaTentativa(reserva(), HOY);
    expect(fila.slice(PRIMERA_A_COMPLETAR - 1)).toEqual(["", "", "", "", "", ""]);
  });

  it("lo que ya se sabe viene cargado, para que no se pise con un vacío", () => {
    const fila = filaTentativa(
      reserva({ huesped_nombre: "Sabina", adultos: 2, ninos: 0, payout_monto: 185.5 }),
      HOY,
    );
    expect(fila.slice(PRIMERA_A_COMPLETAR - 1)).toEqual(["Sabina", "", "2", "0", "", "185.5"]);
  });

  it("muestra la marca pendiente del calendario, no las ya resueltas", () => {
    expect(
      filaTentativa(reserva({ cambios: [{ tipo: "posible_cancelacion", estado: "pendiente" }] }), HOY)[8],
    ).toBe("¿Cancelada?");
    expect(
      filaTentativa(reserva({ cambios: [{ tipo: "cambio_fechas", estado: "descartado" }] }), HOY)[8],
    ).toBe("");
  });

  it("sin departamento lo dice", () => {
    expect(filaTentativa(reserva({ depto: null }), HOY)[2]).toBe("Sin departamento");
  });

  it("sin raw no rompe", () => {
    expect(filaTentativa(reserva({ raw: null }), HOY)[7]).toBe("");
  });
});

describe("cuando", () => {
  it("distingue pasada, en curso y futura", () => {
    expect(cuando({ fecha_checkin: "2026-09-01", fecha_checkout: "2026-09-05" }, HOY)).toBe("Pasada");
    expect(cuando({ fecha_checkin: "2026-09-12", fecha_checkout: "2026-09-15" }, HOY)).toBe("En curso");
    // El día de salida el huésped todavía está.
    expect(cuando({ fecha_checkin: "2026-09-10", fecha_checkout: HOY }, HOY)).toBe("En curso");
    expect(cuando({ fecha_checkin: "2026-09-14", fecha_checkout: "2026-09-16" }, HOY)).toBe("Futura");
  });
});

describe("linkAirbnb", () => {
  it("arma la URL del panel de anfitrión", () => {
    expect(linkAirbnb("HM4DBP5RZR")).toBe(
      "https://www.airbnb.com/hosting/reservations/details/HM4DBP5RZR",
    );
  });
});
