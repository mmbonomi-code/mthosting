import { describe, expect, it } from "vitest";
import {
  decidirLateCheckout,
  departamentoListo,
  momentoDeEvento,
  ventanaDisponible,
  ventanaInsuficiente,
} from "./reglas";

describe("momentoDeEvento", () => {
  const contractual = "2026-08-08";
  const clave = (fechaCoordinada: string | null, horaCoordinada: string | null) =>
    momentoDeEvento({ fechaCoordinada, horaCoordinada, fechaContractual: contractual });

  it("ordena por hora dentro del mismo día", () => {
    expect([clave(null, "16:00"), clave(null, "02:00"), clave(null, "12:00")].sort()).toEqual([
      clave(null, "02:00"),
      clave(null, "12:00"),
      clave(null, "16:00"),
    ]);
  });

  it("las 02:00 del día siguiente van después de las 21:30 de hoy", () => {
    expect(clave("2026-08-09", "02:00") > clave(null, "21:30")).toBe(true);
  });

  it("un movimiento adelantado al día anterior va primero", () => {
    expect(clave("2026-08-07", "23:00") < clave(null, "00:30")).toBe(true);
  });

  it("sin hora va al fondo de su día, pero antes del día siguiente", () => {
    expect(clave(null, null) > clave(null, "23:55")).toBe(true);
    expect(clave(null, null) < clave("2026-08-09", "02:00")).toBe(true);
  });

  it("tolera los segundos que devuelve Postgres", () => {
    expect(clave(null, "16:00:00")).toBe(clave(null, "16:00"));
  });

  it("sin ninguna fecha queda último", () => {
    const huerfano = momentoDeEvento({
      fechaCoordinada: null,
      horaCoordinada: "02:00",
      fechaContractual: null,
    });
    expect(huerfano > clave("2026-08-09", "23:00")).toBe(true);
  });
});

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
  const F = "2026-08-17"; // el mismo día para salida y entrada, salvo que un test diga otra cosa
  const mismoDia = { fechaSalida: F, fechaEntrada: F };

  it("salida tarde y entrada antes del mínimo: imposible limpiar", () => {
    expect(
      ventanaInsuficiente({ ...mismoDia, horaSalida: "11:30", horaEntrada: "11:45", ...umbrales }),
    ).toBe(true);
    // 12:00 no es MENOR a 12:00: entra justo en el mínimo, no alerta.
    expect(
      ventanaInsuficiente({ ...mismoDia, horaSalida: "11:30", horaEntrada: "12:00", ...umbrales }),
    ).toBe(false);
  });

  it("entrar antes o al mismo tiempo que sale el anterior el mismo día siempre alerta", () => {
    // El huésped nuevo llegaría con el viejo todavía adentro.
    expect(
      ventanaInsuficiente({ ...mismoDia, horaSalida: "10:00", horaEntrada: "09:00", ...umbrales }),
    ).toBe(true);
    expect(
      ventanaInsuficiente({ ...mismoDia, horaSalida: "10:00", horaEntrada: "10:00", ...umbrales }),
    ).toBe(true);
  });

  it("salida temprano no alerta aunque entren temprano", () => {
    expect(
      ventanaInsuficiente({ ...mismoDia, horaSalida: "10:00", horaEntrada: "11:00", ...umbrales }),
    ).toBe(false);
  });

  it("sin horarios cargados no alerta", () => {
    expect(
      ventanaInsuficiente({ ...mismoDia, horaSalida: null, horaEntrada: "11:00", ...umbrales }),
    ).toBe(false);
  });

  it("días distintos NUNCA alertan, aunque la hora de salida sea 'mayor' que la de entrada", () => {
    // Caso real: MARCELO VIANNA, AUSTRIA 1 (20/08/2026). Salió el 17/8 a las
    // 18:00 y el siguiente entra el 21/8 a las 15:00. Comparando solo las
    // horas, "15:00" ≤ "18:00" daba "imposible limpiar" con cuatro días de
    // por medio. Con las fechas, no hay ninguna duda de que sobra tiempo.
    expect(
      ventanaInsuficiente({
        fechaSalida: "2026-08-17",
        horaSalida: "18:00",
        fechaEntrada: "2026-08-21",
        horaEntrada: "15:00",
        ...umbrales,
      }),
    ).toBe(false);
  });

  it("días consecutivos tampoco alertan: la regla es solo para el mismo día", () => {
    expect(
      ventanaInsuficiente({
        fechaSalida: "2026-08-17",
        horaSalida: "23:00",
        fechaEntrada: "2026-08-18",
        horaEntrada: "08:00",
        ...umbrales,
      }),
    ).toBe(false);
  });

  it("sin alguna de las dos fechas no alerta: no se puede saber si es el mismo día", () => {
    expect(
      ventanaInsuficiente({
        fechaSalida: null,
        horaSalida: "18:00",
        fechaEntrada: "2026-08-21",
        horaEntrada: "15:00",
        ...umbrales,
      }),
    ).toBe(false);
  });
});
