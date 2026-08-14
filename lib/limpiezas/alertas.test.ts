import { describe, expect, it } from "vitest";
import {
  dosLimpiezasElMismoDia,
  limpiezasEnMedioDeEstadia,
  revisarLimpiezas,
  type EstadiaRevisar,
  type LimpiezaRevisar,
} from "./alertas";

const DEPTO = "d1";

function limpieza(cambios: Partial<LimpiezaRevisar> = {}): LimpiezaRevisar {
  return {
    id: "l1",
    depto_id: DEPTO,
    fecha: "2026-08-14",
    tipo: "normal",
    estado: "pendiente",
    ...cambios,
  };
}

function estadia(cambios: Partial<EstadiaRevisar> = {}): EstadiaRevisar {
  return {
    depto_id: DEPTO,
    codigo_reserva: "HMTEST0001",
    fecha_checkin: "2026-08-10",
    fecha_checkout: "2026-08-20",
    cancelada: false,
    descartada: false,
    ...cambios,
  };
}

describe("limpiezasEnMedioDeEstadia", () => {
  it("avisa cuando cae con el huésped adentro y no está marcada como tal", () => {
    const alertas = limpiezasEnMedioDeEstadia([limpieza()], [estadia()]);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].motivo).toBe("en_medio_de_estadia");
    expect(alertas[0].detalle).toContain("HMTEST0001");
  });

  it("no avisa si está marcada como limpieza con huéspedes", () => {
    // Ese es el caso legítimo: un cambio de blancos pedido por el huésped.
    const alertas = limpiezasEnMedioDeEstadia(
      [limpieza({ tipo: "con_huespedes" })],
      [estadia()],
    );
    expect(alertas).toHaveLength(0);
  });

  it("el día de entrada y el de salida no cuentan como 'en el medio'", () => {
    // Son justo los días en que la limpieza es lo normal.
    for (const fecha of ["2026-08-10", "2026-08-20"]) {
      expect(limpiezasEnMedioDeEstadia([limpieza({ fecha })], [estadia()])).toHaveLength(0);
    }
  });

  it("una reserva cancelada o descartada no genera alarma", () => {
    expect(
      limpiezasEnMedioDeEstadia([limpieza()], [estadia({ cancelada: true })]),
    ).toHaveLength(0);
    expect(
      limpiezasEnMedioDeEstadia([limpieza()], [estadia({ descartada: true })]),
    ).toHaveLength(0);
  });

  it("no confunde departamentos", () => {
    const alertas = limpiezasEnMedioDeEstadia(
      [limpieza()],
      [estadia({ depto_id: "otro" })],
    );
    expect(alertas).toHaveLength(0);
  });

  it("una limpieza cancelada no alarma", () => {
    expect(
      limpiezasEnMedioDeEstadia([limpieza({ estado: "cancelada" })], [estadia()]),
    ).toHaveLength(0);
  });
});

describe("dosLimpiezasElMismoDia", () => {
  it("avisa sobre las DOS, no sobre una sola", () => {
    // Hay que poder ver las dos en la lista para decidir cuál sobra.
    const alertas = dosLimpiezasElMismoDia([
      limpieza({ id: "a" }),
      limpieza({ id: "b" }),
    ]);
    expect(alertas.map((a) => a.limpieza_id).sort()).toEqual(["a", "b"]);
  });

  it("una sola por día no alarma", () => {
    expect(
      dosLimpiezasElMismoDia([
        limpieza({ id: "a", fecha: "2026-08-14" }),
        limpieza({ id: "b", fecha: "2026-08-15" }),
      ]),
    ).toHaveLength(0);
  });

  it("el mismo día en departamentos distintos no alarma", () => {
    expect(
      dosLimpiezasElMismoDia([
        limpieza({ id: "a" }),
        limpieza({ id: "b", depto_id: "otro" }),
      ]),
    ).toHaveLength(0);
  });

  it("una cancelada no cuenta para el par", () => {
    expect(
      dosLimpiezasElMismoDia([
        limpieza({ id: "a" }),
        limpieza({ id: "b", estado: "cancelada" }),
      ]),
    ).toHaveLength(0);
  });
});

describe("revisarLimpiezas", () => {
  it("junta los dos motivos y los indexa por limpieza", () => {
    const enMedio = limpieza({ id: "a", fecha: "2026-08-14" });
    const otraIgual = limpieza({ id: "b", fecha: "2026-08-14" });
    const porLimpieza = revisarLimpiezas([enMedio, otraIgual], [estadia()]);
    expect(porLimpieza.get("a")).toHaveLength(2);
    expect(porLimpieza.get("b")).toHaveLength(2);
  });

  it("sin problemas, no devuelve nada", () => {
    expect(revisarLimpiezas([limpieza({ fecha: "2026-08-20" })], [estadia()]).size).toBe(0);
  });
});
