import { describe, expect, it } from "vitest";
import {
  decidirLateCheckout,
  departamentoListo,
  ventanaDisponible,
  ventanaInsuficiente,
} from "./reglas";

describe("departamentoListo", () => {
  it("está listo si se limpió entre la última salida y esta llegada", () => {
    expect(
      departamentoListo({
        limpiezas: [{ fecha: "2026-08-10", estado: "hecha" }],
        ultimoCheckout: "2026-08-10",
        fechaLlegada: "2026-08-10",
      }),
    ).toBe(true);
  });

  it("el tiempo transcurrido no importa: limpiado el lunes, entra el jueves", () => {
    expect(
      departamentoListo({
        limpiezas: [{ fecha: "2026-08-10", estado: "verificada" }],
        ultimoCheckout: "2026-08-10",
        fechaLlegada: "2026-08-13",
      }),
    ).toBe(true);
  });

  it("una limpieza pendiente o asignada NO deja el depto listo", () => {
    for (const estado of ["pendiente", "asignada", "en_curso"] as const) {
      expect(
        departamentoListo({
          limpiezas: [{ fecha: "2026-08-10", estado }],
          ultimoCheckout: "2026-08-10",
          fechaLlegada: "2026-08-12",
        }),
      ).toBe(false);
    }
  });

  it("si hubo otra salida en el medio, la limpieza vieja ya no sirve", () => {
    expect(
      departamentoListo({
        // Se limpió el 5, pero después hubo una estadía que salió el 10.
        limpiezas: [{ fecha: "2026-08-05", estado: "hecha" }],
        ultimoCheckout: "2026-08-10",
        fechaLlegada: "2026-08-12",
      }),
    ).toBe(false);
  });

  it("una limpieza posterior a la llegada no cuenta", () => {
    expect(
      departamentoListo({
        limpiezas: [{ fecha: "2026-08-15", estado: "hecha" }],
        ultimoCheckout: "2026-08-10",
        fechaLlegada: "2026-08-12",
      }),
    ).toBe(false);
  });

  it("sin salidas previas (primera reserva) alcanza con cualquier limpieza terminada", () => {
    expect(
      departamentoListo({
        limpiezas: [{ fecha: "2026-07-01", estado: "hecha" }],
        ultimoCheckout: null,
        fechaLlegada: "2026-08-12",
      }),
    ).toBe(true);
  });
});

describe("decidirLateCheckout", () => {
  const limpieza = { id: "l1", fecha: "2026-08-15", estado: "pendiente" as const };

  it("sin check-in ese día, la limpieza se mueve al día siguiente y se informa", () => {
    const d = decidirLateCheckout({
      fechaCheckout: "2026-08-15",
      hayCheckinEseDia: false,
      limpieza,
    });
    expect(d).toEqual({
      accion: "mover",
      nuevaFecha: "2026-08-16",
      aviso: expect.stringContaining("2026-08-16"),
    });
  });

  it("con check-in ese día el sistema NO decide: conflicto", () => {
    const d = decidirLateCheckout({
      fechaCheckout: "2026-08-15",
      hayCheckinEseDia: true,
      limpieza,
    });
    expect(d.accion).toBe("conflicto");
  });

  it("una limpieza ya en marcha no se mueve sola", () => {
    for (const estado of ["en_curso", "hecha", "verificada"] as const) {
      const d = decidirLateCheckout({
        fechaCheckout: "2026-08-15",
        hayCheckinEseDia: false,
        limpieza: { ...limpieza, estado },
      });
      expect(d.accion).toBe("conflicto");
    }
  });

  it("si la limpieza ya estaba en otra fecha, no se toca", () => {
    const d = decidirLateCheckout({
      fechaCheckout: "2026-08-15",
      hayCheckinEseDia: false,
      limpieza: { ...limpieza, fecha: "2026-08-20" },
    });
    expect(d.accion).toBe("nada");
  });

  it("sin limpieza no hay nada que mover", () => {
    const d = decidirLateCheckout({
      fechaCheckout: "2026-08-15",
      hayCheckinEseDia: false,
      limpieza: null,
    });
    expect(d.accion).toBe("nada");
  });

  it("cruza el fin de mes correctamente", () => {
    const d = decidirLateCheckout({
      fechaCheckout: "2026-08-31",
      hayCheckinEseDia: false,
      limpieza: { ...limpieza, fecha: "2026-08-31" },
    });
    expect(d).toMatchObject({ accion: "mover", nuevaFecha: "2026-09-01" });
  });
});

describe("ventanaDisponible", () => {
  it("muestra el rango cuando están los dos horarios", () => {
    expect(ventanaDisponible("11:00:00", "15:00:00")).toBe("11:00 a 15:00");
  });

  it("sin alguno de los dos no muestra nada", () => {
    expect(ventanaDisponible(null, "15:00")).toBeNull();
    expect(ventanaDisponible("11:00", null)).toBeNull();
  });
});

describe("ventanaInsuficiente", () => {
  const umbrales = { horaLimiteCheckout: "11:00", horaMinimaCheckin: "12:00" };

  it("salida 11:30 y entrada 12:00 el mismo día: imposible limpiar", () => {
    expect(
      ventanaInsuficiente({ horaSalida: "11:30", horaEntrada: "12:00", ...umbrales }),
    ).toBe(false);
    // 12:00 no es MENOR a 12:00; el caso de la spec es entrada anterior al mínimo.
    expect(
      ventanaInsuficiente({ horaSalida: "11:30", horaEntrada: "11:45", ...umbrales }),
    ).toBe(true);
  });

  it("salida temprano no alerta aunque entren temprano", () => {
    expect(
      ventanaInsuficiente({ horaSalida: "10:00", horaEntrada: "11:00", ...umbrales }),
    ).toBe(false);
  });

  it("sin horarios cargados no alerta", () => {
    expect(
      ventanaInsuficiente({ horaSalida: null, horaEntrada: "11:00", ...umbrales }),
    ).toBe(false);
  });
});
