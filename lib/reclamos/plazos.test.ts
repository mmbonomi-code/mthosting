import { describe, expect, it } from "vitest";
import {
  diasRestantes,
  plazosDeReclamo,
  requiereAtencion,
  semaforoDeReclamo,
  textoDePlazo,
  type EstadoReclamo,
} from "./plazos";

const CHECKOUT = "2026-08-01";

describe("plazosDeReclamo", () => {
  it("13 días para presentar y 30 para escalar, desde el check-out", () => {
    const p = plazosDeReclamo(CHECKOUT, "borrador");
    // 13 y no 14: el sistema vence un día antes que Airbnb, a propósito.
    expect(p.limite_resolucion).toBe("2026-08-14");
    expect(p.limite_aircover).toBe("2026-08-31");
  });

  it("mientras no se presentó, el reloj que corre es el de los 13 días", () => {
    for (const estado of ["borrador", "por_presentar"] as EstadoReclamo[]) {
      expect(plazosDeReclamo(CHECKOUT, estado).limite_vigente).toBe("2026-08-14");
    }
  });

  it("una vez presentado, pasa a correr el de AirCover", () => {
    expect(plazosDeReclamo(CHECKOUT, "presentado").limite_vigente).toBe("2026-08-31");
  });

  it("un reclamo terminado no tiene plazo", () => {
    for (const estado of [
      "escalado",
      "cobrado",
      "rechazado",
      "descartado",
    ] as EstadoReclamo[]) {
      expect(plazosDeReclamo(CHECKOUT, estado).limite_vigente).toBeNull();
    }
  });

  it("cruza el fin de mes sin equivocarse", () => {
    const p = plazosDeReclamo("2026-12-28", "borrador");
    expect(p.limite_resolucion).toBe("2027-01-10");
    expect(p.limite_aircover).toBe("2027-01-27");
  });

  it("febrero de un año bisiesto tampoco lo corre", () => {
    expect(plazosDeReclamo("2028-02-20", "borrador").limite_resolucion).toBe(
      "2028-03-04",
    );
  });
});

describe("diasRestantes", () => {
  it("cero es vence hoy", () => {
    expect(diasRestantes("2026-08-15", "2026-08-15")).toBe(0);
  });

  it("negativo es ya venció", () => {
    expect(diasRestantes("2026-08-15", "2026-08-18")).toBe(-3);
  });

  it("no se marea con el cambio de mes", () => {
    expect(diasRestantes("2026-09-02", "2026-08-30")).toBe(3);
  });
});

describe("semaforoDeReclamo", () => {
  const semaforo = (hoy: string, estado: EstadoReclamo = "borrador") =>
    semaforoDeReclamo(CHECKOUT, estado, hoy).semaforo;

  it("pasado el límite es vencido", () => {
    expect(semaforo("2026-08-15")).toBe("vencido");
  });

  it("el mismo día del límite todavía es urgente, no vencido", () => {
    expect(semaforo("2026-08-14")).toBe("urgente");
  });

  it("tres días o menos es urgente", () => {
    expect(semaforo("2026-08-11")).toBe("urgente");
  });

  it("cuatro días ya es próximo", () => {
    expect(semaforo("2026-08-10")).toBe("proximo");
  });

  it("siete días es el último día de próximo", () => {
    expect(semaforo("2026-08-07")).toBe("proximo");
    expect(semaforo("2026-08-06")).toBe("tranquilo");
  });

  it("un reclamo cobrado no tiene semáforo aunque el check-out sea viejo", () => {
    expect(semaforo("2027-01-01", "cobrado")).toBe("sin_plazo");
  });

  it("una reserva sin fecha de check-out no inventa un plazo", () => {
    expect(semaforoDeReclamo(null, "borrador", "2026-08-10").semaforo).toBe("sin_plazo");
  });

  it("devuelve también el límite y los días, para mostrarlos", () => {
    expect(semaforoDeReclamo(CHECKOUT, "presentado", "2026-08-29")).toEqual({
      semaforo: "urgente",
      limite: "2026-08-31",
      dias: 2,
    });
  });
});

describe("requiereAtencion", () => {
  it("vencidos y urgentes entran en la alerta; el resto no", () => {
    expect(requiereAtencion("vencido")).toBe(true);
    expect(requiereAtencion("urgente")).toBe(true);
    expect(requiereAtencion("proximo")).toBe(false);
    expect(requiereAtencion("tranquilo")).toBe(false);
    expect(requiereAtencion("sin_plazo")).toBe(false);
  });
});

describe("textoDePlazo", () => {
  it("dice las cosas como se dicen", () => {
    expect(textoDePlazo(0)).toBe("Vence hoy");
    expect(textoDePlazo(1)).toBe("Vence mañana");
    expect(textoDePlazo(5)).toBe("Vence en 5 días");
    expect(textoDePlazo(-1)).toBe("Vencido hace 1 día");
    expect(textoDePlazo(-4)).toBe("Vencido hace 4 días");
    expect(textoDePlazo(null)).toBe("Sin plazo");
  });
});
