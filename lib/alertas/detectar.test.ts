import { describe, expect, it } from "vitest";
import {
  conflictosCancelacionOFecha,
  conflictosLateCheckout,
  detectarFaltaLimpieza,
  ventanasInsuficientesGlobal,
} from "./detectar";

describe("ventanasInsuficientesGlobal", () => {
  const umbrales = { horaLimiteCheckout: "11:00", horaMinimaCheckin: "12:00" };

  it("no alerta si la llegada temprana es solo para dejar las valijas", () => {
    const alertas = ventanasInsuficientesGlobal(
      [
        {
          reserva_id: "r1",
          codigo_reserva: "HM1",
          depto_id: "d1",
          tipo: "checkout",
          fecha: "2026-08-20",
          hora: "11:30",
        },
        {
          reserva_id: "r2",
          codigo_reserva: "HM2",
          depto_id: "d1",
          tipo: "checkin",
          fecha: "2026-08-20",
          hora: "10:30",
          soloValijas: true,
        },
      ],
      umbrales,
    );
    expect(alertas).toHaveLength(0);
  });

  it("marca el depto con salida tarde y entrada temprano el mismo día", () => {
    const alertas = ventanasInsuficientesGlobal(
      [
        {
          reserva_id: "r1",
          codigo_reserva: "HM1",
          depto_id: "d1",
          tipo: "checkout",
          fecha: "2026-08-20",
          hora: "11:30",
        },
        {
          reserva_id: "r2",
          codigo_reserva: "HM2",
          depto_id: "d1",
          tipo: "checkin",
          fecha: "2026-08-20",
          hora: "11:45",
        },
      ],
      umbrales,
    );
    expect(alertas).toEqual([
      {
        depto_id: "d1",
        fecha: "2026-08-20",
        salida: { reserva_id: "r1", codigo_reserva: "HM1", hora: "11:30" },
        entrada: { reserva_id: "r2", codigo_reserva: "HM2", hora: "11:45" },
      },
    ]);
  });

  it("no cruza departamentos distintos aunque coincida la fecha", () => {
    const alertas = ventanasInsuficientesGlobal(
      [
        {
          reserva_id: "r1",
          codigo_reserva: "HM1",
          depto_id: "d1",
          tipo: "checkout",
          fecha: "2026-08-20",
          hora: "18:00",
        },
        {
          reserva_id: "r2",
          codigo_reserva: "HM2",
          depto_id: "d2",
          tipo: "checkin",
          fecha: "2026-08-20",
          hora: "09:00",
        },
      ],
      umbrales,
    );
    expect(alertas).toEqual([]);
  });

  it("una ventana holgada no alerta", () => {
    const alertas = ventanasInsuficientesGlobal(
      [
        {
          reserva_id: "r1",
          codigo_reserva: "HM1",
          depto_id: "d1",
          tipo: "checkout",
          fecha: "2026-08-20",
          hora: "10:00",
        },
        {
          reserva_id: "r2",
          codigo_reserva: "HM2",
          depto_id: "d1",
          tipo: "checkin",
          fecha: "2026-08-20",
          hora: "14:00",
        },
      ],
      umbrales,
    );
    expect(alertas).toEqual([]);
  });

  it("un checkout de días distintos al checkin del mismo depto no alerta", () => {
    const alertas = ventanasInsuficientesGlobal(
      [
        {
          reserva_id: "r1",
          codigo_reserva: "HM1",
          depto_id: "d1",
          tipo: "checkout",
          fecha: "2026-08-17",
          hora: "18:00",
        },
        {
          reserva_id: "r2",
          codigo_reserva: "HM2",
          depto_id: "d1",
          tipo: "checkin",
          fecha: "2026-08-21",
          hora: "15:00",
        },
      ],
      umbrales,
    );
    expect(alertas).toEqual([]);
  });
});

describe("detectarFaltaLimpieza", () => {
  it("una reserva sin ninguna limpieza asociada falta por salida", () => {
    const reserva = {
      id: "r1",
      codigo_reserva: "HM1",
      depto_id: "d1",
      fecha_checkin: "2026-08-10",
      fecha_checkout: "2026-08-15",
    };
    const faltantes = detectarFaltaLimpieza([reserva], [reserva], []);
    expect(faltantes).toEqual([
      {
        reserva_id: "r1",
        codigo_reserva: "HM1",
        depto_id: "d1",
        tipo: "salida",
        fecha: "2026-08-15",
      },
      {
        reserva_id: "r1",
        codigo_reserva: "HM1",
        depto_id: "d1",
        tipo: "repaso",
        fecha: "2026-08-10",
      },
    ]);
  });

  it("con las dos limpiezas vivas no falta nada", () => {
    const reserva = {
      id: "r1",
      codigo_reserva: "HM1",
      depto_id: "d1",
      fecha_checkin: "2026-08-10",
      fecha_checkout: "2026-08-15",
    };
    const faltantes = detectarFaltaLimpieza(
      [reserva],
      [reserva],
      [
        { reserva_id: "r1", rol_reserva: "salida", estado: "pendiente" },
        { reserva_id: "r1", rol_reserva: "entrada", estado: "pendiente" },
      ],
    );
    expect(faltantes).toEqual([]);
  });

  it("una limpieza cancelada no cuenta como cobertura", () => {
    const reserva = {
      id: "r1",
      codigo_reserva: "HM1",
      depto_id: "d1",
      fecha_checkin: "2026-08-10",
      fecha_checkout: "2026-08-15",
    };
    const faltantes = detectarFaltaLimpieza(
      [reserva],
      [reserva],
      [{ reserva_id: "r1", rol_reserva: "salida", estado: "cancelada" }],
    );
    expect(faltantes.map((f) => f.tipo)).toContain("salida");
  });

  it("si hay un check-out previo en el depto, no hace falta repaso", () => {
    const r0 = {
      id: "r0",
      codigo_reserva: "HM0",
      depto_id: "d1",
      fecha_checkin: "2026-08-01",
      fecha_checkout: "2026-08-09",
    };
    const r1 = {
      id: "r1",
      codigo_reserva: "HM1",
      depto_id: "d1",
      fecha_checkin: "2026-08-10",
      fecha_checkout: "2026-08-15",
    };
    const faltantes = detectarFaltaLimpieza(
      [r0, r1],
      [r0, r1],
      [
        // r0 es la primera reserva del depto: sí necesita su propio repaso.
        { reserva_id: "r0", rol_reserva: "salida", estado: "pendiente" },
        { reserva_id: "r0", rol_reserva: "entrada", estado: "pendiente" },
        // r1 tiene un check-out previo (r0): no necesita repaso, solo salida.
        { reserva_id: "r1", rol_reserva: "salida", estado: "pendiente" },
      ],
    );
    expect(faltantes).toEqual([]);
  });

  it("el check-out previo puede estar fuera de la ventana que se revisa, en el contexto", () => {
    // Caso real que encontró un chequeo contra la base de desarrollo: si
    // "contexto" fuera la misma ventana acotada que "reservas", un depto
    // cuyo último huésped se fue hace dos meses parecía "sin check-out
    // previo" y marcaba un repaso que no hacía falta.
    const r0Vieja = {
      id: "r0",
      codigo_reserva: "HM0",
      depto_id: "d1",
      fecha_checkin: "2026-05-01",
      fecha_checkout: "2026-05-09",
    };
    const r1EnVentana = {
      id: "r1",
      codigo_reserva: "HM1",
      depto_id: "d1",
      fecha_checkin: "2026-08-10",
      fecha_checkout: "2026-08-15",
    };
    const faltantes = detectarFaltaLimpieza(
      [r1EnVentana], // solo esta entra en la ventana que se revisa
      [r0Vieja, r1EnVentana], // pero el contexto sí conoce la reserva vieja
      [{ reserva_id: "r1", rol_reserva: "salida", estado: "pendiente" }],
    );
    expect(faltantes).toEqual([]);
  });
});

describe("conflictosCancelacionOFecha", () => {
  it("reserva cancelada con limpieza en_curso: conflicto", () => {
    const conflictos = conflictosCancelacionOFecha(
      [
        {
          id: "l1",
          depto_id: "d1",
          fecha: "2026-08-15",
          estado: "en_curso",
          rol_reserva: "salida",
          reserva_id: "r1",
        },
      ],
      [
        {
          id: "r1",
          codigo_reserva: "HM1",
          cancelada: true,
          descartada: false,
          fecha_checkin: "2026-08-10",
          fecha_checkout: "2026-08-15",
        },
      ],
    );
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].motivo).toBe("cancelada");
  });

  it("reserva cancelada con limpieza pendiente: no conflicto (se cancela sola)", () => {
    const conflictos = conflictosCancelacionOFecha(
      [
        {
          id: "l1",
          depto_id: "d1",
          fecha: "2026-08-15",
          estado: "pendiente",
          rol_reserva: "salida",
          reserva_id: "r1",
        },
      ],
      [
        {
          id: "r1",
          codigo_reserva: "HM1",
          cancelada: true,
          descartada: false,
          fecha_checkin: "2026-08-10",
          fecha_checkout: "2026-08-15",
        },
      ],
    );
    expect(conflictos).toEqual([]);
  });

  it("la fecha de la reserva cambió y la limpieza ya está hecha: conflicto", () => {
    const conflictos = conflictosCancelacionOFecha(
      [
        {
          id: "l1",
          depto_id: "d1",
          fecha: "2026-08-15",
          estado: "hecha",
          rol_reserva: "salida",
          reserva_id: "r1",
        },
      ],
      [
        {
          id: "r1",
          codigo_reserva: "HM1",
          cancelada: false,
          descartada: false,
          fecha_checkin: "2026-08-10",
          fecha_checkout: "2026-08-17",
        },
      ],
    );
    expect(conflictos).toHaveLength(1);
    expect(conflictos[0].motivo).toBe("fecha_cambio");
  });

  it("la fecha coincide y la reserva sigue viva: no conflicto", () => {
    const conflictos = conflictosCancelacionOFecha(
      [
        {
          id: "l1",
          depto_id: "d1",
          fecha: "2026-08-15",
          estado: "verificada",
          rol_reserva: "salida",
          reserva_id: "r1",
        },
      ],
      [
        {
          id: "r1",
          codigo_reserva: "HM1",
          cancelada: false,
          descartada: false,
          fecha_checkin: "2026-08-10",
          fecha_checkout: "2026-08-15",
        },
      ],
    );
    expect(conflictos).toEqual([]);
  });
});

describe("conflictosLateCheckout", () => {
  it("late check-out con entrada el mismo día en el mismo depto: conflicto", () => {
    const conflictos = conflictosLateCheckout([
      {
        id: "r1",
        codigo_reserva: "HM1",
        depto_id: "d1",
        fecha_checkin: "2026-08-10",
        fecha_checkout: "2026-08-20",
        lateCheckout: true,
      },
      {
        id: "r2",
        codigo_reserva: "HM2",
        depto_id: "d1",
        fecha_checkin: "2026-08-20",
        fecha_checkout: "2026-08-25",
        lateCheckout: false,
      },
    ]);
    expect(conflictos).toEqual([
      {
        depto_id: "d1",
        fecha: "2026-08-20",
        sale: { reserva_id: "r1", codigo_reserva: "HM1" },
        entra: { reserva_id: "r2", codigo_reserva: "HM2" },
      },
    ]);
  });

  it("late check-out sin nadie entrando ese día: sin conflicto", () => {
    const conflictos = conflictosLateCheckout([
      {
        id: "r1",
        codigo_reserva: "HM1",
        depto_id: "d1",
        fecha_checkin: "2026-08-10",
        fecha_checkout: "2026-08-20",
        lateCheckout: true,
      },
    ]);
    expect(conflictos).toEqual([]);
  });

  it("sin marcar late, aunque coincida el día no es conflicto de late", () => {
    const conflictos = conflictosLateCheckout([
      {
        id: "r1",
        codigo_reserva: "HM1",
        depto_id: "d1",
        fecha_checkin: "2026-08-10",
        fecha_checkout: "2026-08-20",
        lateCheckout: false,
      },
      {
        id: "r2",
        codigo_reserva: "HM2",
        depto_id: "d1",
        fecha_checkin: "2026-08-20",
        fecha_checkout: "2026-08-25",
        lateCheckout: false,
      },
    ]);
    expect(conflictos).toEqual([]);
  });
});
