/**
 * Detección de las listas 0.b, 1, 4 y 5 del panel de alertas (spec §3.6).
 *
 * Funciones PURAS, sin tocar la base: reciben el estado actual (reservas y
 * limpiezas ya traídas) y devuelven qué está sin resolver. El panel entero se
 * recalcula en cada visita, nada queda guardado — mismo criterio que
 * económico: total recalculado, nunca un valor viejo mostrado como si fuera
 * de hoy.
 *
 * Las listas 0 y 2 no viven acá: la 0 reutiliza `limpiezasEnMedioDeEstadia`
 * de `lib/limpiezas/alertas.ts` (ya en producción en /semana), y la 2 es el
 * mismo filtro `!asignado_a` que ya usa /semana, sin lógica propia.
 */

import { ventanaInsuficiente } from "@/lib/eventos/reglas";

/** Estados en los que ya hay alguien trabajando: el sistema no los toca. */
const INTOCABLE: ReadonlySet<string> = new Set(["en_curso", "hecha", "verificada"]);

// ---------------------------------------------------------------------------
// 0.b — Ventana insuficiente, en TODOS los departamentos (no uno solo)
// ---------------------------------------------------------------------------

export type MovimientoVentana = {
  reserva_id: string;
  codigo_reserva: string;
  depto_id: string;
  tipo: "checkin" | "checkout";
  /** Fecha coordinada si existe, si no la de la reserva. */
  fecha: string;
  /** Hora coordinada si existe. Sin ella no hay ventana que evaluar. */
  hora: string | null;
  /**
   * Solo en las llegadas: el acceso coordinado es de método "valijas", así
   * que esa hora es una entrega de equipaje y no el huésped entrando.
   */
  soloValijas?: boolean;
};

export type AlertaVentana = {
  depto_id: string;
  fecha: string;
  salida: { reserva_id: string; codigo_reserva: string; hora: string | null };
  entrada: { reserva_id: string; codigo_reserva: string; hora: string | null };
};

/**
 * Recorre todos los departamentos y marca los recambios del mismo día donde
 * no da el tiempo material para limpiar (spec §2.8.quater). Es el mismo
 * cálculo que ya hace la ficha de un evento individual, pero barriendo todos
 * los departamentos de una vez en lugar de uno a la vez.
 */
export function ventanasInsuficientesGlobal(
  movimientos: MovimientoVentana[],
  umbrales: { horaLimiteCheckout: string; horaMinimaCheckin: string },
): AlertaVentana[] {
  const porDeptoFecha = new Map<string, MovimientoVentana[]>();
  for (const m of movimientos) {
    const clave = `${m.depto_id}|${m.fecha}`;
    porDeptoFecha.set(clave, [...(porDeptoFecha.get(clave) ?? []), m]);
  }

  const alertas: AlertaVentana[] = [];
  for (const grupo of porDeptoFecha.values()) {
    const salidas = grupo.filter((m) => m.tipo === "checkout");
    const entradas = grupo.filter((m) => m.tipo === "checkin");
    for (const salida of salidas) {
      for (const entrada of entradas) {
        const imposible = ventanaInsuficiente({
          fechaSalida: salida.fecha,
          horaSalida: salida.hora,
          fechaEntrada: entrada.fecha,
          horaEntrada: entrada.hora,
          horaLimiteCheckout: umbrales.horaLimiteCheckout,
          horaMinimaCheckin: umbrales.horaMinimaCheckin,
          entradaSoloValijas: entrada.soloValijas ?? false,
        });
        if (!imposible) continue;
        alertas.push({
          depto_id: salida.depto_id,
          fecha: salida.fecha,
          salida: {
            reserva_id: salida.reserva_id,
            codigo_reserva: salida.codigo_reserva,
            hora: salida.hora,
          },
          entrada: {
            reserva_id: entrada.reserva_id,
            codigo_reserva: entrada.codigo_reserva,
            hora: entrada.hora,
          },
        });
      }
    }
  }
  return alertas;
}

// ---------------------------------------------------------------------------
// 1 — Falta limpieza
// ---------------------------------------------------------------------------

export type ReservaCobertura = {
  id: string;
  codigo_reserva: string;
  depto_id: string;
  fecha_checkin: string;
  fecha_checkout: string;
};

export type LimpiezaCobertura = {
  reserva_id: string | null;
  rol_reserva: "salida" | "entrada" | "durante" | null;
  estado: string;
};

export type FaltaLimpieza = {
  reserva_id: string;
  codigo_reserva: string;
  depto_id: string;
  /** "salida" = falta la limpieza del check-out. "repaso" = falta el repaso de entrada. */
  tipo: "salida" | "repaso";
  fecha: string;
};

/**
 * Reservas cuyo check-out (o, si son la primera del departamento, su
 * check-in) no tiene ninguna limpieza viva asociada (spec §3.6, lista 1).
 *
 * Espeja la misma regla que genera las limpiezas al importar
 * (`planificarLimpiezas`, §2.8): una por cada check-out, y un repaso solo
 * cuando el check-in no tiene ningún check-out previo en ese departamento.
 * Acá no se genera nada — se detecta el hueco para que decida una persona
 * (alguien canceló la limpieza a mano, o el generador nunca corrió sobre esa
 * reserva).
 *
 * `contexto` es aparte de `reservas` a propósito, mismo criterio que
 * `planificarLimpiezas`: `reservas` es la ventana que se está revisando,
 * `contexto` es TODO lo no cancelado/descartado del departamento, sin
 * ventana. Si los dos fueran la misma lista acotada, un depto cuyo último
 * huésped se fue hace dos meses parecería "sin check-out previo" solo porque
 * esa reserva vieja quedó afuera del recorte, y marcaría un repaso que no
 * hace falta.
 */
export function detectarFaltaLimpieza(
  reservas: ReservaCobertura[],
  contexto: ReservaCobertura[],
  limpiezas: LimpiezaCobertura[],
): FaltaLimpieza[] {
  const vivas = limpiezas.filter((l) => l.estado !== "cancelada");
  const cubierto = new Set<string>();
  for (const l of vivas) {
    if (l.reserva_id && l.rol_reserva) cubierto.add(`${l.reserva_id}|${l.rol_reserva}`);
  }

  const porDepto = new Map<string, ReservaCobertura[]>();
  for (const r of contexto) {
    porDepto.set(r.depto_id, [...(porDepto.get(r.depto_id) ?? []), r]);
  }

  const faltantes: FaltaLimpieza[] = [];
  for (const r of reservas) {
    if (!cubierto.has(`${r.id}|salida`)) {
      faltantes.push({
        reserva_id: r.id,
        codigo_reserva: r.codigo_reserva,
        depto_id: r.depto_id,
        tipo: "salida",
        fecha: r.fecha_checkout,
      });
    }

    const previas = (porDepto.get(r.depto_id) ?? []).filter(
      (o) => o.id !== r.id && o.fecha_checkout <= r.fecha_checkin,
    );
    if (previas.length === 0 && !cubierto.has(`${r.id}|entrada`)) {
      faltantes.push({
        reserva_id: r.id,
        codigo_reserva: r.codigo_reserva,
        depto_id: r.depto_id,
        tipo: "repaso",
        fecha: r.fecha_checkin,
      });
    }
  }
  return faltantes;
}

// ---------------------------------------------------------------------------
// 4 — Conflictos de cancelación / cambio de fecha
// ---------------------------------------------------------------------------

export type LimpiezaConReserva = {
  id: string;
  depto_id: string;
  fecha: string;
  estado: string;
  rol_reserva: "salida" | "entrada" | "durante" | null;
  reserva_id: string | null;
};

export type ReservaEstado = {
  id: string;
  codigo_reserva: string;
  cancelada: boolean;
  descartada: boolean;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
};

export type ConflictoReserva = {
  limpieza_id: string;
  reserva_id: string;
  codigo_reserva: string;
  depto_id: string;
  fecha_limpieza: string;
  motivo: "cancelada" | "descartada" | "fecha_cambio";
  detalle: string;
};

/**
 * Limpiezas ya `en_curso`, `hecha` o `verificada` cuya reserva se movió por
 * debajo (spec §3.6, lista 4; ver §2.8.ter y §2.10.ter). El sistema no las
 * toca solo porque ya hay alguien trabajando — quedan pidiendo una decisión.
 *
 * Cubre tres casos: la reserva se canceló, se descartó, o cambió de fecha,
 * en los tres casos con la limpieza ya en marcha. El primero es además la
 * puerta para cargar `fecha_checkout_real` (spec §2.8): si el huésped estaba
 * de verdad adentro cuando se canceló, esa es la fecha real de salida.
 */
export function conflictosCancelacionOFecha(
  limpiezas: LimpiezaConReserva[],
  reservas: ReservaEstado[],
): ConflictoReserva[] {
  const reservasPorId = new Map(reservas.map((r) => [r.id, r]));

  const conflictos: ConflictoReserva[] = [];
  for (const l of limpiezas) {
    if (!INTOCABLE.has(l.estado) || !l.reserva_id) continue;
    const r = reservasPorId.get(l.reserva_id);
    if (!r) continue;

    const base = {
      limpieza_id: l.id,
      reserva_id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: l.depto_id,
      fecha_limpieza: l.fecha,
    };

    if (r.cancelada) {
      conflictos.push({
        ...base,
        motivo: "cancelada",
        detalle: `La reserva se canceló, pero su limpieza del ${l.fecha} ya está ${l.estado}. Si el huésped estaba de verdad adentro, cargá la fecha real de salida en la reserva.`,
      });
      continue;
    }
    if (r.descartada) {
      conflictos.push({
        ...base,
        motivo: "descartada",
        detalle: `La reserva se descartó, pero su limpieza del ${l.fecha} ya está ${l.estado}. No se canceló sola.`,
      });
      continue;
    }

    const fechaEsperada = l.rol_reserva === "entrada" ? r.fecha_checkin : r.fecha_checkout;
    if (fechaEsperada && fechaEsperada !== l.fecha) {
      conflictos.push({
        ...base,
        motivo: "fecha_cambio",
        detalle: `La reserva cambió de fecha (ahora ${fechaEsperada}), pero la limpieza del ${l.fecha} ya está ${l.estado}. No se movió sola.`,
      });
    }
  }
  return conflictos;
}

// ---------------------------------------------------------------------------
// 5 — Conflictos de late check-out
// ---------------------------------------------------------------------------

export type ReservaLate = {
  id: string;
  codigo_reserva: string;
  depto_id: string;
  fecha_checkin: string;
  fecha_checkout: string;
  lateCheckout: boolean;
};

export type ConflictoLate = {
  depto_id: string;
  fecha: string;
  sale: { reserva_id: string; codigo_reserva: string };
  entra: { reserva_id: string; codigo_reserva: string };
};

/**
 * Late check-out con alguien entrando ese mismo día (spec §2.9 y §3.6, lista
 * 5): el sistema no decide, y la limpieza se queda donde estaba en vez de
 * moverse sola. Misma condición exacta que evalúa `alternarLateCheckout` al
 * marcar el late, pero mirando TODAS las reservas en vez de una sola.
 */
export function conflictosLateCheckout(reservas: ReservaLate[]): ConflictoLate[] {
  const porDeptoCheckin = new Map<string, ReservaLate[]>();
  for (const r of reservas) {
    const clave = `${r.depto_id}|${r.fecha_checkin}`;
    porDeptoCheckin.set(clave, [...(porDeptoCheckin.get(clave) ?? []), r]);
  }

  const conflictos: ConflictoLate[] = [];
  for (const r of reservas) {
    if (!r.lateCheckout) continue;
    const entrantes = (porDeptoCheckin.get(`${r.depto_id}|${r.fecha_checkout}`) ?? []).filter(
      (e) => e.id !== r.id,
    );
    for (const entra of entrantes) {
      conflictos.push({
        depto_id: r.depto_id,
        fecha: r.fecha_checkout,
        sale: { reserva_id: r.id, codigo_reserva: r.codigo_reserva },
        entra: { reserva_id: entra.id, codigo_reserva: entra.codigo_reserva },
      });
    }
  }
  return conflictos;
}

// ---------------------------------------------------------------------------
// 6 — Arreglos reportados desde una limpieza, sin resolver
// ---------------------------------------------------------------------------

export type ArregloCrudo = {
  id: string;
  depto_id: string;
  limpieza_id: string | null;
  descripcion: string;
  estado: string | null;
  activo: boolean;
  created_at: string;
};

export type ArregloPendiente = {
  id: string;
  depto_id: string;
  limpieza_id: string;
  descripcion: string;
  created_at: string;
};

/** El único estado que apaga la alerta. Lo demás sigue pendiente. */
export const ARREGLO_RESUELTO = "resuelto";

/**
 * Lo que la limpieza reportó para arreglar y todavía nadie resolvió.
 *
 * Solo los que nacieron de una limpieza (`limpieza_id`): son los que alguien
 * vio con sus propios ojos en el departamento y quedaron esperando. Un
 * arreglo cargado a mano por administración ya lo está mirando quien lo
 * cargó.
 *
 * Antes de esto, "algo para arreglar" creaba una fila que no leía ninguna
 * pantalla: la persiana rota se reportaba y no se enteraba nadie.
 */
export function arreglosSinResolver(arreglos: ArregloCrudo[]): ArregloPendiente[] {
  return arreglos
    .filter(
      (a) =>
        a.activo &&
        a.limpieza_id !== null &&
        (a.estado ?? "") !== ARREGLO_RESUELTO,
    )
    .map((a) => ({
      id: a.id,
      depto_id: a.depto_id,
      limpieza_id: a.limpieza_id!,
      descripcion: a.descripcion,
      created_at: a.created_at,
    }))
    // El más viejo primero: es el que lleva más tiempo esperando.
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}
