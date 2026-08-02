/**
 * Generación automática de limpiezas y eventos de estadía (spec §2.8).
 *
 * Función PURA: recibe el estado actual y devuelve qué habría que crear,
 * mover o cancelar. No toca la base, así que cada regla tiene test.
 *
 * Las reglas delicadas que resuelve:
 *  - Cada check-out genera su limpieza de salida.
 *  - Un check-in sin check-out previo (primera reserva, o hueco tras un
 *    bloqueo) genera un repaso.
 *  - `urgente`: otra reserva entra el mismo día que sale esta.
 *  - `prox_checkin`: cuándo llega el próximo huésped (la ventana disponible).
 *  - Si cambia la fecha de la reserva, la limpieza se mueve con ella —
 *    salvo que ya esté en curso, hecha o verificada: ahí decide una persona.
 *  - Cancelar una reserva futura cancela su limpieza; cancelarla con el
 *    huésped adentro NO la cancela: pide la fecha real de salida.
 */

export type EstadoLimpieza =
  | "pendiente"
  | "asignada"
  | "en_curso"
  | "hecha"
  | "verificada"
  | "cancelada";

export type RolReserva = "salida" | "entrada" | "durante";

/** Estados que el sistema no toca jamás: ya hay una persona trabajando. */
const INTOCABLES: ReadonlySet<EstadoLimpieza> = new Set([
  "en_curso",
  "hecha",
  "verificada",
]);

export type ReservaPlan = {
  id: string;
  codigo_reserva: string;
  depto_id: string | null;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  cancelada: boolean;
  descartada: boolean;
};

export type EventoExistente = {
  id: string;
  reserva_id: string;
  tipo: "checkin" | "checkout";
  estado: string;
};

export type LimpiezaExistente = {
  id: string;
  reserva_id: string | null;
  rol_reserva: RolReserva | null;
  fecha: string;
  estado: EstadoLimpieza;
  urgente: boolean;
  prox_checkin: string | null;
};

export type Bloqueo = {
  depto_id: string;
  fecha_desde: string;
  fecha_hasta: string;
};

export type LimpiezaNueva = {
  depto_id: string;
  reserva_id: string;
  rol_reserva: RolReserva;
  fecha: string;
  tipo: "normal" | "repaso";
  estado: "pendiente";
  urgente: boolean;
  prox_checkin: string | null;
};

export type LimpiezaCambio = {
  id: string;
  fecha?: string;
  urgente?: boolean;
  prox_checkin?: string | null;
  estado?: EstadoLimpieza;
};

export type Plan = {
  eventosNuevos: { reserva_id: string; tipo: "checkin" | "checkout" }[];
  eventosACancelar: string[];
  limpiezasNuevas: LimpiezaNueva[];
  limpiezasAActualizar: LimpiezaCambio[];
  anomalias: string[];
  generadas: number;
  movidas: number;
  canceladas: number;
};

export type EntradaPlanificar = {
  /** Las reservas del lote que hay que procesar. */
  reservas: ReservaPlan[];
  /**
   * Todas las reservas NO canceladas y NO descartadas de los departamentos
   * afectados, para calcular check-out previo, urgencia y próximo check-in.
   */
  contexto: ReservaPlan[];
  bloqueos: Bloqueo[];
  eventos: EventoExistente[];
  limpiezas: LimpiezaExistente[];
  /** Fecha de hoy en Buenos Aires (`yyyy-mm-dd`). */
  hoy: string;
  /**
   * Códigos de reserva cuya cancelación se detecta EN ESTA importación.
   * Solo esas alertan si la estadía está en curso: una reserva cancelada
   * hace meses, aunque sus fechas incluyan hoy, no tiene a nadie adentro.
   */
  cancelacionesNuevas?: ReadonlySet<string>;
};

/** Fecha `yyyy-mm-dd` → `yyyy-mm-ddT00:00:00`, que es lo que espera la columna. */
function comoTimestamp(fecha: string | null): string | null {
  return fecha === null ? null : `${fecha}T00:00:00`;
}

export function planificarLimpiezas({
  reservas,
  contexto,
  bloqueos,
  eventos,
  limpiezas,
  hoy,
  cancelacionesNuevas = new Set<string>(),
}: EntradaPlanificar): Plan {
  const plan: Plan = {
    eventosNuevos: [],
    eventosACancelar: [],
    limpiezasNuevas: [],
    limpiezasAActualizar: [],
    anomalias: [],
    generadas: 0,
    movidas: 0,
    canceladas: 0,
  };

  // Índices para no recorrer todo por cada fila (nada de O(n²)).
  const porDepto = new Map<string, ReservaPlan[]>();
  for (const r of contexto) {
    if (!r.depto_id) continue;
    if (!porDepto.has(r.depto_id)) porDepto.set(r.depto_id, []);
    porDepto.get(r.depto_id)!.push(r);
  }

  const bloqueosPorDepto = new Map<string, Bloqueo[]>();
  for (const b of bloqueos) {
    if (!bloqueosPorDepto.has(b.depto_id)) bloqueosPorDepto.set(b.depto_id, []);
    bloqueosPorDepto.get(b.depto_id)!.push(b);
  }

  const eventosPorReserva = new Map<string, EventoExistente[]>();
  for (const e of eventos) {
    if (!eventosPorReserva.has(e.reserva_id)) eventosPorReserva.set(e.reserva_id, []);
    eventosPorReserva.get(e.reserva_id)!.push(e);
  }

  const limpiezaPorReservaRol = new Map<string, LimpiezaExistente>();
  for (const l of limpiezas) {
    if (l.reserva_id && l.rol_reserva) {
      limpiezaPorReservaRol.set(`${l.reserva_id}|${l.rol_reserva}`, l);
    }
  }

  /** Cancela la limpieza de una reserva, salvo que ya la esté haciendo alguien. */
  const cancelarLimpiezasDe = (reserva: ReservaPlan, motivo: string) => {
    for (const rol of ["salida", "entrada"] as const) {
      const existente = limpiezaPorReservaRol.get(`${reserva.id}|${rol}`);
      if (!existente || existente.estado === "cancelada") continue;
      if (INTOCABLES.has(existente.estado)) {
        plan.anomalias.push(
          `${reserva.codigo_reserva}: ${motivo}, pero su limpieza del ${existente.fecha} ya está ${existente.estado}. No se cancela sola: decidilo a mano.`,
        );
        continue;
      }
      plan.limpiezasAActualizar.push({ id: existente.id, estado: "cancelada" });
      plan.canceladas++;
    }
  };

  for (const reserva of reservas) {
    const { depto_id, fecha_checkin, fecha_checkout } = reserva;

    // Sin departamento no hay limpieza posible: la reserva está en la bandeja.
    if (!depto_id || !fecha_checkin || !fecha_checkout) continue;

    // --- Eventos de estadía: siempre existen los dos ---
    const eventosDeLaReserva = eventosPorReserva.get(reserva.id) ?? [];
    const activa = !reserva.cancelada && !reserva.descartada;

    for (const tipo of ["checkin", "checkout"] as const) {
      const existente = eventosDeLaReserva.find((e) => e.tipo === tipo);
      if (!existente) {
        if (activa) plan.eventosNuevos.push({ reserva_id: reserva.id, tipo });
      } else if (!activa && existente.estado !== "cancelado") {
        plan.eventosACancelar.push(existente.id);
      }
    }

    // --- Reservas descartadas o canceladas ---
    if (reserva.descartada) {
      cancelarLimpiezasDe(reserva, "la reserva fue descartada");
      continue;
    }

    if (reserva.cancelada) {
      const enCurso = fecha_checkin <= hoy && hoy <= fecha_checkout;
      const reciencancelada = cancelacionesNuevas.has(reserva.codigo_reserva);
      if (enCurso && reciencancelada) {
        // El huésped está adentro: la limpieza se mantiene y alguien tiene
        // que cargar cuándo se va realmente.
        plan.anomalias.push(
          `${reserva.codigo_reserva}: se canceló con la estadía en curso. La limpieza NO se cancela: cargá la fecha real de salida.`,
        );
      } else {
        cancelarLimpiezasDe(reserva, "la reserva se canceló");
      }
      continue;
    }

    // --- Reserva activa: generar o ajustar sus limpiezas ---
    const otrasDelDepto = (porDepto.get(depto_id) ?? []).filter(
      (r) => r.id !== reserva.id,
    );

    /** ¿Entra otro huésped el mismo día que sale este? */
    const urgente = otrasDelDepto.some((r) => r.fecha_checkin === fecha_checkout);

    /** El próximo check-in a partir de una fecha: es el fin de la ventana. */
    const proximoCheckinDesde = (fecha: string): string | null => {
      const candidatos = otrasDelDepto
        .map((r) => r.fecha_checkin)
        .filter((f): f is string => f !== null && f >= fecha)
        .sort();
      return candidatos[0] ?? null;
    };

    /**
     * Crea la limpieza si no existe; si existe, la mueve o la corrige.
     * Nunca toca una limpieza en curso, hecha o verificada.
     */
    const asegurarLimpieza = (
      rol: RolReserva,
      fecha: string,
      tipo: "normal" | "repaso",
      urgenteLimpieza: boolean,
      proxCheckin: string | null,
    ) => {
      const existente = limpiezaPorReservaRol.get(`${reserva.id}|${rol}`);

      if (!existente) {
        plan.limpiezasNuevas.push({
          depto_id,
          reserva_id: reserva.id,
          rol_reserva: rol,
          fecha,
          tipo,
          estado: "pendiente",
          urgente: urgenteLimpieza,
          prox_checkin: comoTimestamp(proxCheckin),
        });
        plan.generadas++;
        return;
      }

      const cambios: LimpiezaCambio = { id: existente.id };
      let hayCambios = false;

      if (existente.fecha !== fecha) {
        if (INTOCABLES.has(existente.estado)) {
          // La reserva se movió pero la limpieza ya está en marcha: alerta.
          plan.anomalias.push(
            `${reserva.codigo_reserva}: la fecha de la reserva cambió a ${fecha}, pero su limpieza del ${existente.fecha} ya está ${existente.estado}. No se movió: decidilo a mano.`,
          );
          return;
        }
        cambios.fecha = fecha;
        hayCambios = true;
        plan.movidas++;
      }

      // Una reserva descartada que reapareció recupera su limpieza.
      if (existente.estado === "cancelada") {
        cambios.estado = "pendiente";
        hayCambios = true;
        plan.generadas++;
      }

      if (existente.urgente !== urgenteLimpieza) {
        cambios.urgente = urgenteLimpieza;
        hayCambios = true;
      }

      const proxTimestamp = comoTimestamp(proxCheckin);
      if ((existente.prox_checkin ?? null) !== proxTimestamp) {
        cambios.prox_checkin = proxTimestamp;
        hayCambios = true;
      }

      if (hayCambios) plan.limpiezasAActualizar.push(cambios);
    };

    // 1. Limpieza de salida: una por cada check-out.
    asegurarLimpieza(
      "salida",
      fecha_checkout,
      "normal",
      urgente,
      proximoCheckinDesde(fecha_checkout),
    );

    // 2. Repaso: si el huésped entra sin que haya habido una salida antes.
    const checkoutsPrevios = otrasDelDepto
      .map((r) => r.fecha_checkout)
      .filter((f): f is string => f !== null && f <= fecha_checkin)
      .sort();
    const ultimoCheckout = checkoutsPrevios[checkoutsPrevios.length - 1] ?? null;

    // Un bloqueo entre la salida anterior y esta llegada también pide repaso:
    // el departamento estuvo ocupado o cerrado en el medio.
    const hayBloqueoEnElMedio = (bloqueosPorDepto.get(depto_id) ?? []).some(
      (b) =>
        b.fecha_hasta >= (ultimoCheckout ?? "0000-01-01") &&
        b.fecha_desde <= fecha_checkin,
    );

    if (ultimoCheckout === null || hayBloqueoEnElMedio) {
      asegurarLimpieza("entrada", fecha_checkin, "repaso", false, fecha_checkin);
    }
  }

  return plan;
}
