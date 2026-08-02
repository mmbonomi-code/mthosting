import { describe, expect, it } from "vitest";
import {
  planificarLimpiezas,
  type EntradaPlanificar,
  type LimpiezaExistente,
  type ReservaPlan,
} from "./planificar";

const HOY = "2026-08-02";
const DEPTO = "depto-1";

function reserva(parcial: Partial<ReservaPlan> = {}): ReservaPlan {
  return {
    id: "r1",
    codigo_reserva: "HMTEST0001",
    depto_id: DEPTO,
    fecha_checkin: "2026-08-10",
    fecha_checkout: "2026-08-15",
    cancelada: false,
    descartada: false,
    ...parcial,
  };
}

function limpieza(parcial: Partial<LimpiezaExistente> = {}): LimpiezaExistente {
  return {
    id: "l1",
    reserva_id: "r1",
    rol_reserva: "salida",
    fecha: "2026-08-15",
    estado: "pendiente",
    urgente: false,
    prox_checkin: null,
    ...parcial,
  };
}

/** Corre el planificador con lo mínimo, completando lo que no se pasa. */
function planificar(entrada: Partial<EntradaPlanificar>) {
  const reservas = entrada.reservas ?? [reserva()];
  return planificarLimpiezas({
    reservas,
    contexto: entrada.contexto ?? reservas,
    bloqueos: entrada.bloqueos ?? [],
    eventos: entrada.eventos ?? [],
    limpiezas: entrada.limpiezas ?? [],
    hoy: entrada.hoy ?? HOY,
    cancelacionesNuevas: entrada.cancelacionesNuevas,
  });
}

describe("limpieza de salida", () => {
  it("cada check-out genera su limpieza, pendiente y sin responsable", () => {
    const plan = planificar({});
    const salida = plan.limpiezasNuevas.find((l) => l.rol_reserva === "salida");
    expect(salida).toMatchObject({
      depto_id: DEPTO,
      reserva_id: "r1",
      rol_reserva: "salida",
      fecha: "2026-08-15",
      tipo: "normal",
      estado: "pendiente",
    });
    expect(plan.generadas).toBeGreaterThan(0);
  });

  it("la limpieza cuelga del departamento, nunca del nombre del anuncio", () => {
    const plan = planificar({});
    for (const l of plan.limpiezasNuevas) expect(l.depto_id).toBe(DEPTO);
  });

  it("una reserva sin departamento no genera nada (está en la bandeja)", () => {
    const plan = planificar({ reservas: [reserva({ depto_id: null })] });
    expect(plan.limpiezasNuevas).toHaveLength(0);
    expect(plan.eventosNuevos).toHaveLength(0);
  });
});

describe("repaso", () => {
  it("la primera reserva del departamento genera repaso previo a la entrada", () => {
    const plan = planificar({});
    const repaso = plan.limpiezasNuevas.find((l) => l.rol_reserva === "entrada");
    expect(repaso).toMatchObject({
      rol_reserva: "entrada",
      tipo: "repaso",
      fecha: "2026-08-10",
      estado: "pendiente",
    });
  });

  it("si hubo un check-out previo NO hace falta repaso", () => {
    const previa = reserva({
      id: "r0",
      codigo_reserva: "HMPREVIA",
      fecha_checkin: "2026-08-01",
      fecha_checkout: "2026-08-08",
    });
    const actual = reserva();
    const plan = planificar({ reservas: [actual], contexto: [previa, actual] });
    expect(plan.limpiezasNuevas.some((l) => l.rol_reserva === "entrada")).toBe(false);
    expect(plan.limpiezasNuevas.some((l) => l.rol_reserva === "salida")).toBe(true);
  });

  it("un bloqueo entre la salida anterior y esta llegada vuelve a pedir repaso", () => {
    const previa = reserva({
      id: "r0",
      codigo_reserva: "HMPREVIA",
      fecha_checkin: "2026-08-01",
      fecha_checkout: "2026-08-05",
    });
    const actual = reserva();
    const plan = planificar({
      reservas: [actual],
      contexto: [previa, actual],
      bloqueos: [{ depto_id: DEPTO, fecha_desde: "2026-08-06", fecha_hasta: "2026-08-09" }],
    });
    expect(plan.limpiezasNuevas.some((l) => l.rol_reserva === "entrada")).toBe(true);
  });
});

describe("urgente y ventana disponible", () => {
  it("marca urgente cuando otro huésped entra el mismo día que sale este", () => {
    const sale = reserva({ id: "r1", fecha_checkin: "2026-08-10", fecha_checkout: "2026-08-15" });
    const entra = reserva({
      id: "r2",
      codigo_reserva: "HMENTRA",
      fecha_checkin: "2026-08-15",
      fecha_checkout: "2026-08-20",
    });
    const plan = planificar({ reservas: [sale], contexto: [sale, entra] });
    const salida = plan.limpiezasNuevas.find((l) => l.rol_reserva === "salida");
    expect(salida?.urgente).toBe(true);
    // La ventana termina cuando llega el próximo huésped: ese mismo día.
    expect(salida?.prox_checkin).toBe("2026-08-15T00:00:00");
  });

  it("sin nadie entrando ese día no es urgente", () => {
    const plan = planificar({});
    const salida = plan.limpiezasNuevas.find((l) => l.rol_reserva === "salida");
    expect(salida?.urgente).toBe(false);
  });

  it("prox_checkin toma el próximo check-in del MISMO departamento", () => {
    const sale = reserva({ id: "r1", fecha_checkout: "2026-08-15" });
    const lejana = reserva({
      id: "r2",
      codigo_reserva: "HMLEJANA",
      fecha_checkin: "2026-08-22",
      fecha_checkout: "2026-08-25",
    });
    const otroDepto = reserva({
      id: "r3",
      codigo_reserva: "HMOTRO",
      depto_id: "depto-2",
      fecha_checkin: "2026-08-16",
      fecha_checkout: "2026-08-18",
    });
    const plan = planificar({
      reservas: [sale],
      contexto: [sale, lejana, otroDepto],
    });
    const salida = plan.limpiezasNuevas.find((l) => l.rol_reserva === "salida");
    // El 16 es de otro departamento: no cuenta.
    expect(salida?.prox_checkin).toBe("2026-08-22T00:00:00");
  });
});

describe("idempotencia", () => {
  it("volver a planificar con las limpiezas ya creadas no cambia nada", () => {
    const r = reserva();
    const yaCreadas = [
      limpieza({ id: "l-salida", rol_reserva: "salida", fecha: "2026-08-15" }),
      limpieza({
        id: "l-entrada",
        rol_reserva: "entrada",
        fecha: "2026-08-10",
        prox_checkin: "2026-08-10T00:00:00",
      }),
    ];
    const plan = planificar({ reservas: [r], limpiezas: yaCreadas });
    expect(plan.limpiezasNuevas).toHaveLength(0);
    expect(plan.limpiezasAActualizar).toHaveLength(0);
    expect(plan.movidas).toBe(0);
  });
});

describe("cambio de fecha de la reserva", () => {
  it("la limpieza pendiente se mueve con la reserva", () => {
    const r = reserva({ fecha_checkout: "2026-08-18" });
    const plan = planificar({
      reservas: [r],
      limpiezas: [limpieza({ fecha: "2026-08-15", estado: "pendiente" })],
    });
    expect(plan.limpiezasAActualizar).toContainEqual(
      expect.objectContaining({ id: "l1", fecha: "2026-08-18" }),
    );
    expect(plan.movidas).toBe(1);
  });

  it("una limpieza ya asignada también se mueve", () => {
    const r = reserva({ fecha_checkout: "2026-08-18" });
    const plan = planificar({
      reservas: [r],
      limpiezas: [limpieza({ fecha: "2026-08-15", estado: "asignada" })],
    });
    expect(plan.movidas).toBe(1);
  });

  it("una limpieza en curso, hecha o verificada NO se mueve: alerta", () => {
    for (const estado of ["en_curso", "hecha", "verificada"] as const) {
      const r = reserva({ fecha_checkout: "2026-08-18" });
      const plan = planificar({
        reservas: [r],
        limpiezas: [limpieza({ fecha: "2026-08-15", estado })],
      });
      expect(plan.movidas).toBe(0);
      expect(plan.limpiezasAActualizar.some((c) => c.fecha !== undefined)).toBe(false);
      expect(plan.anomalias.join(" ")).toMatch(new RegExp(estado));
    }
  });
});

describe("cancelaciones", () => {
  it("cancelar una reserva FUTURA cancela su limpieza sola", () => {
    const r = reserva({ cancelada: true, fecha_checkin: "2026-08-10", fecha_checkout: "2026-08-15" });
    const plan = planificar({
      reservas: [r],
      contexto: [],
      limpiezas: [limpieza({ fecha: "2026-08-15" })],
    });
    expect(plan.limpiezasAActualizar).toContainEqual({ id: "l1", estado: "cancelada" });
    expect(plan.canceladas).toBe(1);
  });

  it("cancelar con el huésped adentro NO cancela la limpieza: pide fecha real", () => {
    const r = reserva({
      cancelada: true,
      fecha_checkin: "2026-07-30",
      fecha_checkout: "2026-08-10",
    });
    const plan = planificar({
      reservas: [r],
      contexto: [],
      limpiezas: [limpieza({ fecha: "2026-08-10" })],
      hoy: HOY, // 02/08: la estadía está en curso
      cancelacionesNuevas: new Set([r.codigo_reserva]),
    });
    expect(plan.canceladas).toBe(0);
    expect(plan.limpiezasAActualizar).toHaveLength(0);
    expect(plan.anomalias.join(" ")).toMatch(/fecha real de salida/i);
  });

  it("una cancelación vieja cuyas fechas incluyen hoy no alerta: no hay nadie adentro", () => {
    const r = reserva({
      cancelada: true,
      fecha_checkin: "2026-07-30",
      fecha_checkout: "2026-08-10",
    });
    const plan = planificar({
      reservas: [r],
      contexto: [],
      limpiezas: [limpieza({ fecha: "2026-08-10" })],
      hoy: HOY,
      // No viene en cancelacionesNuevas: ya estaba cancelada de antes.
    });
    expect(plan.anomalias).toHaveLength(0);
    expect(plan.canceladas).toBe(1);
  });

  it("cancelar no toca una limpieza que ya está hecha: alerta", () => {
    const r = reserva({ cancelada: true });
    const plan = planificar({
      reservas: [r],
      contexto: [],
      limpiezas: [limpieza({ estado: "hecha" })],
    });
    expect(plan.canceladas).toBe(0);
    expect(plan.anomalias.join(" ")).toMatch(/hecha/);
  });

  it("descartar una reserva cancela sus limpiezas y sus eventos", () => {
    const r = reserva({ descartada: true });
    const plan = planificar({
      reservas: [r],
      contexto: [],
      limpiezas: [limpieza()],
      eventos: [
        { id: "e1", reserva_id: "r1", tipo: "checkin", estado: "pendiente" },
        { id: "e2", reserva_id: "r1", tipo: "checkout", estado: "pendiente" },
      ],
    });
    expect(plan.canceladas).toBe(1);
    expect(plan.eventosACancelar).toEqual(["e1", "e2"]);
  });

  it("una reserva descartada que reaparece recupera su limpieza", () => {
    const r = reserva(); // ya no está descartada
    const plan = planificar({
      reservas: [r],
      limpiezas: [limpieza({ estado: "cancelada", fecha: "2026-08-15" })],
    });
    expect(plan.limpiezasAActualizar).toContainEqual(
      expect.objectContaining({ id: "l1", estado: "pendiente" }),
    );
  });
});

describe("eventos de estadía", () => {
  it("cada reserva activa tiene su check-in y su check-out", () => {
    const plan = planificar({});
    expect(plan.eventosNuevos).toEqual([
      { reserva_id: "r1", tipo: "checkin" },
      { reserva_id: "r1", tipo: "checkout" },
    ]);
  });

  it("si ya existen no se duplican", () => {
    const plan = planificar({
      eventos: [
        { id: "e1", reserva_id: "r1", tipo: "checkin", estado: "coordinado" },
        { id: "e2", reserva_id: "r1", tipo: "checkout", estado: "pendiente" },
      ],
    });
    expect(plan.eventosNuevos).toHaveLength(0);
    expect(plan.eventosACancelar).toHaveLength(0);
  });

  it("una reserva cancelada cancela sus eventos", () => {
    const plan = planificar({
      reservas: [reserva({ cancelada: true })],
      contexto: [],
      eventos: [{ id: "e1", reserva_id: "r1", tipo: "checkin", estado: "pendiente" }],
    });
    expect(plan.eventosACancelar).toEqual(["e1"]);
  });
});
