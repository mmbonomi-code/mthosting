/**
 * Generación automática de limpiezas y eventos de estadía (spec §2.8).
 *
 * Función PURA: recibe el estado actual y devuelve qué habría que crear,
 * mover o cancelar. No toca la base, así que cada regla tiene test.
 *
 * Las reglas delicadas que resuelve:
 *  - Cada check-out genera su limpieza de salida.
 *  - Un check-in SIN NINGÚN check-out previo genera un repaso. Un bloqueo del
 *    calendario NO genera repaso (decisión del dueño, 13/08/2026): los
 *    bloqueos que manda Airbnb son en su enorme mayoría el propio día de
 *    recambio, y generaban un repaso al pedo por cada reserva.
 *  - El repaso se CANCELA solo cuando deja de corresponder. Antes solo se
 *    creaba: si el motivo desaparecía —por ejemplo, después aparecía la
 *    reserva anterior que faltaba importar— quedaba pegado para siempre.
 *  - `urgente`: otra reserva entra el mismo día en que se limpia.
 *  - `prox_checkin`: cuándo llega el próximo huésped (la ventana disponible).
 *  - Si cambia la fecha de la reserva, la limpieza se mueve con ella —
 *    salvo que ya esté en curso, hecha o verificada: ahí decide una persona.
 *  - Cancelar una reserva cancela su limpieza, SIEMPRE. Si se cancela con la
 *    estadía en curso se avisa, pero la limpieza se cancela igual: la mayoría
 *    de esos casos son reservas tentativas del calendario que nunca tuvieron
 *    a nadie adentro.
 *  - Un departamento no puede tener dos limpiezas el mismo día. Si el cálculo
 *    llega a esa situación, crea una sola y avisa: son casi siempre dos
 *    reservas superpuestas, que es el problema de verdad.
 */

import { estadoAlQuitarResponsable } from "./asignar";

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
  /** Necesario para saber qué días del departamento ya están ocupados. */
  depto_id: string;
  reserva_id: string | null;
  rol_reserva: RolReserva | null;
  fecha: string;
  estado: EstadoLimpieza;
  urgente: boolean;
  prox_checkin: string | null;
  /** La fecha la eligió una persona: no se mueve sola. */
  fecha_manual: boolean;
  /** La canceló una persona: no revive sola. */
  cancelada_manual: boolean;
  /** Quién la tiene. Se suelta si la limpieza cambia de edificio. */
  asignado_a: string | null;
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
  depto_id?: string;
  // Al cambiar de edificio se suelta el responsable y su monto congelado.
  asignado_a?: null;
  monto_pactado?: null;
  moneda?: null;
  tarifa_id?: null;
};

export type Plan = {
  eventosNuevos: { reserva_id: string; tipo: "checkin" | "checkout" }[];
  eventosACancelar: string[];
  /** Los de una reserva que volvió a estar viva: vuelven a pendiente. */
  eventosAReactivar: string[];
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
  eventos,
  limpiezas,
  hoy,
  cancelacionesNuevas = new Set<string>(),
}: EntradaPlanificar): Plan {
  const plan: Plan = {
    eventosNuevos: [],
    eventosACancelar: [],
    eventosAReactivar: [],
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

  /**
   * Qué días de cada departamento ya tienen una limpieza viva. Un día ocupado
   * no admite otra: el valor es el id de la que está, para poder nombrarla en
   * el aviso. Se mantiene al día a medida que el plan crea y cancela.
   */
  const ocupadas = new Map<string, string>();
  const dia = (deptoId: string, fecha: string) => `${deptoId}|${fecha}`;
  for (const l of limpiezas) {
    if (l.estado !== "cancelada") ocupadas.set(dia(l.depto_id, l.fecha), l.id);
  }

  /** Limpiezas que en este plan pasan a otro departamento: id → depto nuevo. */
  const mudadas = new Map<string, string>();

  /** Cancela UNA limpieza, salvo que ya la esté haciendo alguien. */
  const cancelarLimpieza = (
    reserva: ReservaPlan,
    rol: RolReserva,
    motivo: string,
  ): void => {
    const existente = limpiezaPorReservaRol.get(`${reserva.id}|${rol}`);
    if (!existente || existente.estado === "cancelada") return;
    if (INTOCABLES.has(existente.estado)) {
      plan.anomalias.push(
        `${reserva.codigo_reserva}: ${motivo}, pero su limpieza del ${existente.fecha} ya está ${existente.estado}. No se cancela sola: decidilo a mano.`,
      );
      return;
    }
    plan.limpiezasAActualizar.push({ id: existente.id, estado: "cancelada" });
    plan.canceladas++;
    // El día del departamento vuelve a quedar libre (en el edificio donde
    // quedó, si en esta misma pasada se mudó).
    const deptoActual = mudadas.get(existente.id) ?? existente.depto_id;
    if (ocupadas.get(dia(deptoActual, existente.fecha)) === existente.id) {
      ocupadas.delete(dia(deptoActual, existente.fecha));
    }
  };

  const cancelarLimpiezasDe = (reserva: ReservaPlan, motivo: string) => {
    for (const rol of ["salida", "entrada"] as const) {
      cancelarLimpieza(reserva, rol, motivo);
    }
  };

  // Orden estable: con dos reservas superpuestas, cuál se queda con el día no
  // puede depender de cómo vinieron ordenadas de la base.
  const enOrden = [...reservas].sort(
    (a, b) =>
      (a.fecha_checkin ?? "").localeCompare(b.fecha_checkin ?? "") ||
      a.codigo_reserva.localeCompare(b.codigo_reserva),
  );

  // Sin departamento o sin fechas no hay limpieza posible: la reserva está en
  // la bandeja de sin asignar.
  const utiles = enOrden.filter(
    (r) => r.depto_id && r.fecha_checkin && r.fecha_checkout,
  );

  // --- Eventos de estadía: siempre existen los dos ---
  for (const reserva of utiles) {
    const eventosDeLaReserva = eventosPorReserva.get(reserva.id) ?? [];
    const activa = !reserva.cancelada && !reserva.descartada;

    for (const tipo of ["checkin", "checkout"] as const) {
      const existente = eventosDeLaReserva.find((e) => e.tipo === tipo);
      if (!existente) {
        if (activa) plan.eventosNuevos.push({ reserva_id: reserva.id, tipo });
      } else if (!activa && existente.estado !== "cancelado") {
        plan.eventosACancelar.push(existente.id);
      } else if (activa && existente.estado === "cancelado") {
        // Una reserva descartada que reaparece vuelve entera (§2.10.ter): sin
        // esto recuperaba la limpieza pero no el check-in ni el check-out, y
        // la llegada del huésped no figuraba en el día. Los eventos solo los
        // cancela el planificador, así que nunca se le está pisando la
        // decisión a una persona.
        plan.eventosAReactivar.push(existente.id);
      }
    }
  }

  // --- PRIMERO las bajas ---
  //
  // Las cancelaciones van antes que las altas, y no en una sola pasada. Si no,
  // el día que ocupa una limpieza que está por cancelarse bloquea la limpieza
  // de la reserva que sí queda, y el departamento se queda sin limpiar.
  for (const reserva of utiles) {
    if (reserva.descartada) {
      cancelarLimpiezasDe(reserva, "la reserva fue descartada");
      continue;
    }
    if (!reserva.cancelada) continue;

    // La limpieza de una reserva cancelada se cancela SIEMPRE (decisión del
    // dueño, 13/08/2026). Antes se hacía una excepción cuando la estadía
    // estaba en curso, por miedo a dejar sin limpiar un departamento con
    // gente adentro. En la práctica esos casos son reservas tentativas del
    // calendario que se caen, y la limpieza fantasma quedaba en la lista sin
    // ninguna marca de que la reserva ya no existía.
    const enCurso =
      reserva.fecha_checkin! <= hoy && hoy <= reserva.fecha_checkout!;
    if (enCurso && cancelacionesNuevas.has(reserva.codigo_reserva)) {
      plan.anomalias.push(
        `${reserva.codigo_reserva}: se canceló con la estadía en curso (${reserva.fecha_checkin} a ${reserva.fecha_checkout}) y se canceló su limpieza. Si el huésped estaba de verdad adentro, cargá la limpieza a mano con la fecha real de salida.`,
      );
    }
    cancelarLimpiezasDe(reserva, "la reserva se canceló");
  }

  // --- La reserva cambió de departamento: sus limpiezas van con ella ---
  //
  // Antes no se movían: la reserva pasaba al departamento nuevo y la limpieza
  // se quedaba en el edificio viejo, así que alguien iba a limpiar donde no
  // había nadie. Va antes de las altas para que el cálculo de días ocupados
  // ya las vea en su lugar nuevo.
  for (const reserva of utiles) {
    if (reserva.cancelada || reserva.descartada) continue;
    const depto_id = reserva.depto_id!;

    for (const existente of limpiezas) {
      if (existente.reserva_id !== reserva.id || existente.depto_id === depto_id) continue;

      if (INTOCABLES.has(existente.estado)) {
        plan.anomalias.push(
          `${reserva.codigo_reserva}: la reserva cambió de departamento, pero su limpieza del ${existente.fecha} ya está ${existente.estado} en el anterior. No se movió: decidilo a mano.`,
        );
        continue;
      }

      const cambios: LimpiezaCambio = { id: existente.id, depto_id };

      // Otro edificio es otro viaje y, si cambia el tamaño, otro monto: la
      // asignación no se arrastra, se vuelve a decidir (decisión del dueño,
      // 13/09/2026). El monto pactado se suelta, no se recalcula.
      if (existente.asignado_a !== null) {
        Object.assign(cambios, {
          asignado_a: null,
          monto_pactado: null,
          moneda: null,
          tarifa_id: null,
          estado: estadoAlQuitarResponsable(existente.estado),
        });
        plan.anomalias.push(
          `${reserva.codigo_reserva}: su limpieza del ${existente.fecha} pasó al departamento nuevo y quedó sin responsable. Hay que volver a asignarla y avisarle a quien la tenía.`,
        );
      }

      if (existente.estado !== "cancelada") {
        const ocupadaPor = ocupadas.get(dia(depto_id, existente.fecha));
        if (ocupadaPor !== undefined) {
          plan.anomalias.push(
            `${reserva.codigo_reserva}: su limpieza pasó al departamento nuevo, que el ${existente.fecha} ya tenía otra. Quedaron dos: resolvelo a mano.`,
          );
        }
        if (ocupadas.get(dia(existente.depto_id, existente.fecha)) === existente.id) {
          ocupadas.delete(dia(existente.depto_id, existente.fecha));
        }
        ocupadas.set(dia(depto_id, existente.fecha), existente.id);
      }

      mudadas.set(existente.id, depto_id);
      plan.limpiezasAActualizar.push(cambios);
      plan.movidas++;
    }
  }

  // --- DESPUÉS las altas ---
  for (const reserva of utiles) {
    if (reserva.cancelada || reserva.descartada) continue;
    const depto_id = reserva.depto_id!;
    const fecha_checkin = reserva.fecha_checkin!;
    const fecha_checkout = reserva.fecha_checkout!;

    const otrasDelDepto = (porDepto.get(depto_id) ?? []).filter(
      (r) => r.id !== reserva.id,
    );

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
     *
     * `ventana` recibe el día en que se limpia DE VERDAD y devuelve si entra
     * alguien ese día y cuándo llega el próximo. Es una función y no dos
     * valores porque ese día no siempre es el de la reserva: si la fecha la
     * puso una persona, la ventana se mide desde ahí. Antes se medía siempre
     * desde el check-out, y KENNEDY 1 (movida del 15 al 16/09/2026, con un
     * check-in el 16) quedó sin marca de urgente.
     */
    const asegurarLimpieza = (
      rol: RolReserva,
      fecha: string,
      tipo: "normal" | "repaso",
      ventana: (fechaLimpieza: string) => { urgente: boolean; prox: string | null },
    ) => {
      const existente = limpiezaPorReservaRol.get(`${reserva.id}|${rol}`);
      const { urgente: urgenteLimpieza, prox: proxCheckin } = ventana(
        existente?.fecha_manual ? existente.fecha : fecha,
      );

      /** Deja urgente y prox_checkin al día. Devuelve si cambió algo. */
      const corregirVentana = (cambios: LimpiezaCambio): boolean => {
        let cambio = false;
        if (existente!.urgente !== urgenteLimpieza) {
          cambios.urgente = urgenteLimpieza;
          cambio = true;
        }
        const proxTimestamp = comoTimestamp(proxCheckin);
        if ((existente!.prox_checkin ?? null) !== proxTimestamp) {
          cambios.prox_checkin = proxTimestamp;
          cambio = true;
        }
        return cambio;
      };

      if (!existente) {
        // Un departamento no puede tener dos limpiezas el mismo día. Si el
        // día ya está tomado, no se crea la segunda: se avisa. Llegar acá
        // significa casi siempre que hay dos reservas superpuestas en el
        // mismo departamento, y ESE es el problema que hay que mirar.
        const ocupadaPor = ocupadas.get(dia(depto_id, fecha));
        if (ocupadaPor !== undefined) {
          plan.anomalias.push(
            `${reserva.codigo_reserva}: el ${fecha} ese departamento ya tiene otra limpieza. No se creó una segunda. Fijate si no hay dos reservas pisadas.`,
          );
          return;
        }

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
        // El día queda tomado para el resto del plan. Sin id todavía: alcanza
        // con marcarlo, porque una limpieza recién creada no se cancela acá.
        ocupadas.set(dia(depto_id, fecha), "nueva");
        return;
      }

      const cambios: LimpiezaCambio = { id: existente.id };
      let hayCambios = false;

      if (existente.fecha !== fecha) {
        // Una fecha puesta por una persona no la pisa un recálculo. Es la
        // misma regla que ya rige para asignar: el sistema propone, la
        // persona decide (CLAUDE.md). Si la reserva se movió de verdad, se
        // avisa; corregirla por las buenas es lo que hacía que la limpieza
        // volviera sola a su día en cada importación.
        if (existente.fecha_manual) {
          plan.anomalias.push(
            `${reserva.codigo_reserva}: la limpieza está puesta a mano el ${existente.fecha} y por la reserva le tocaría el ${fecha}. No se movió: si corresponde, cambiala vos.`,
          );
          // La fecha no se toca, pero la ventana sí: se mide desde el día
          // que eligió la persona.
          if (corregirVentana(cambios)) plan.limpiezasAActualizar.push(cambios);
          return;
        }
        if (INTOCABLES.has(existente.estado)) {
          // La reserva se movió pero la limpieza ya está en marcha: alerta.
          plan.anomalias.push(
            `${reserva.codigo_reserva}: la fecha de la reserva cambió a ${fecha}, pero su limpieza del ${existente.fecha} ya está ${existente.estado}. No se movió: decidilo a mano.`,
          );
          return;
        }
        // Se mueve igual aunque el día destino esté ocupado: dejarla en una
        // fecha que ya no existe es peor. Pero se avisa.
        const ocupadaPor = ocupadas.get(dia(depto_id, fecha));
        if (ocupadaPor !== undefined && ocupadaPor !== existente.id) {
          plan.anomalias.push(
            `${reserva.codigo_reserva}: su limpieza se movió al ${fecha} y ese día el departamento ya tenía otra. Quedaron dos: resolvelo a mano.`,
          );
        }
        ocupadas.delete(dia(depto_id, existente.fecha));
        ocupadas.set(dia(depto_id, fecha), existente.id);
        cambios.fecha = fecha;
        hayCambios = true;
        plan.movidas++;
      }

      // Una reserva descartada que reapareció recupera su limpieza, salvo que
      // en el medio ese día se haya ocupado con otra.
      //
      // Pero si la canceló una PERSONA, no se revive: esta regla existe para
      // deshacer una cancelación del sistema, no para discutirle a nadie.
      // Antes no distinguía, y una limpieza cancelada a mano volvía a
      // pendiente en la importación siguiente (ARENALES 9, 14/08/2026).
      if (existente.estado === "cancelada" && !existente.cancelada_manual) {
        const ocupadaPor = ocupadas.get(dia(depto_id, fecha));
        if (ocupadaPor !== undefined && ocupadaPor !== existente.id) {
          plan.anomalias.push(
            `${reserva.codigo_reserva}: reapareció, pero el ${fecha} ese departamento ya tiene otra limpieza. Su limpieza queda cancelada.`,
          );
        } else {
          cambios.estado = "pendiente";
          hayCambios = true;
          plan.generadas++;
          ocupadas.set(dia(depto_id, fecha), existente.id);
        }
      }

      if (corregirVentana(cambios)) hayCambios = true;

      if (hayCambios) plan.limpiezasAActualizar.push(cambios);
    };

    // 1. Limpieza de salida: una por cada check-out.
    //    Urgente: entra otro huésped el mismo día en que se limpia.
    asegurarLimpieza("salida", fecha_checkout, "normal", (dia) => {
      const prox = proximoCheckinDesde(dia);
      return { urgente: prox === dia, prox };
    });

    // 2. Repaso: solo si el huésped entra sin que haya habido NINGUNA salida
    //    antes. Es el caso de la primera reserva de un departamento.
    //
    //    Un bloqueo del calendario ya NO genera repaso. Airbnb marca como "no
    //    disponible" el propio día de recambio, así que la regla anterior
    //    disparaba un repaso en casi todas las reservas: 47 de los 58 repasos
    //    vivos al 13/08/2026 salían de ahí, y ninguno hacía falta.
    const checkoutsPrevios = otrasDelDepto
      .map((r) => r.fecha_checkout)
      .filter((f): f is string => f !== null && f <= fecha_checkin)
      .sort();
    const ultimoCheckout = checkoutsPrevios[checkoutsPrevios.length - 1] ?? null;

    if (ultimoCheckout === null) {
      asegurarLimpieza("entrada", fecha_checkin, "repaso", () => ({
        urgente: false,
        prox: fecha_checkin,
      }));
    } else {
      // Hay una salida anterior que ya cubre la limpieza. Si quedó un repaso
      // de cuando sí correspondía, se cancela: hasta ahora el repaso solo se
      // creaba, nunca se sacaba, y quedaba pegado aunque el motivo hubiera
      // desaparecido.
      cancelarLimpieza(
        reserva,
        "entrada",
        `ya hay una salida anterior (${ultimoCheckout}) que cubre la limpieza`,
      );
    }
  }

  return plan;
}
