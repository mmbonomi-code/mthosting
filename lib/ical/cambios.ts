/**
 * Cancelaciones y cambios inferidos del calendario (decisión del dueño,
 * 13/09/2026). Ver la migración `cambios_calendario`.
 *
 * Función PURA: recibe lo que hay en la base y lo que mostraron los
 * calendarios, y devuelve qué marcas crear, actualizar o cerrar. No toca la
 * base, así que cada regla tiene test.
 *
 * El calendario no dice "cancelada": la reserva desaparece. Todo lo de acá es
 * inferencia, y por eso nada se aplica solo — se marca y decide una persona.
 *
 * Las reglas delicadas:
 *
 *  - Solo se comparan reservas cuyo calendario se leyó BIEN en esta corrida.
 *    Un calendario que no respondió no es un calendario vacío.
 *  - Una reserva que no está en su calendario puede estar en el de otro
 *    departamento: se busca en TODOS antes de hablar de cancelación.
 *  - Freno por departamento: si desaparecen TODAS sus reservas futuras (y son
 *    2 o más), no se marca ninguna. Es casi seguro el calendario (link
 *    regenerado, anuncio pausado), no una ola de cancelaciones.
 *  - Freno global: si desaparece más del 20% de lo que se compara (y son 5 o
 *    más), no se marca ninguna.
 *  - Lo frenado no se pierde: vuelve como "retenidas", para que una persona
 *    lo mire y, si corresponde, lo marque igual.
 *  - Un descarte ("sigue en pie") tapa SU firma. Si la situación cambia, la
 *    marca vuelve. Si la reserva vuelve a coincidir con el calendario, el
 *    descarte deja de valer.
 */

export type TipoCambio = "posible_cancelacion" | "cambio_fechas" | "cambio_depto";
export type EstadoCambio = "pendiente" | "confirmado" | "descartado" | "resuelto_solo";

/** Reserva viva de Airbnb, con departamento y salida de hoy en adelante. */
export type ReservaComparable = {
  id: string;
  codigo_reserva: string;
  depto_id: string;
  fecha_checkin: string;
  fecha_checkout: string;
};

export type VistoEnCalendario = {
  codigo: string;
  depto_id: string;
  desde: string;
  hasta: string;
};

export type MarcaExistente = {
  id: string;
  reserva_id: string;
  tipo: TipoCambio;
  estado: EstadoCambio;
  firma: string;
  activo: boolean;
  /**
   * `excel`: la pidió el Excel de tentativas sobre una reserva que el
   * calendario todavía muestra. Que la muestre no la cierra: nunca dejó de
   * mostrarla.
   */
  origen: "calendario" | "excel";
};

export type MarcaNueva = {
  reserva_id: string;
  tipo: TipoCambio;
  firma: string;
  calendario_checkin: string | null;
  calendario_checkout: string | null;
  calendario_depto_id: string | null;
  reserva_checkin: string;
  reserva_checkout: string;
  reserva_depto_id: string;
};

export type MotivoRetencion = "calendario_vacio" | "freno_global";

export type Retenida = {
  depto_id: string;
  motivo: MotivoRetencion;
  reserva_ids: string[];
};

export type PlanCambios = {
  nuevas: MarcaNueva[];
  /** Pendientes cuya situación siguió pero cambió (otras fechas, otro depto). */
  actualizar: (MarcaNueva & { id: string })[];
  /** Pendientes que ya no corresponden: la reserva volvió a coincidir. */
  resueltasSolas: string[];
  /** Descartes que dejan de valer: su situación terminó. */
  descartesVencidos: string[];
  retenidas: Retenida[];
};

/** Desde cuántas reservas de un depto desaparecidas juntas se frena. */
export const MINIMO_CALENDARIO_VACIO = 2;
/** Proporción del total desaparecido a partir de la cual se frena todo. */
export const PROPORCION_FRENO_GLOBAL = 0.2;
/** Con menos desaparecidas que esto, el freno global no aplica. */
export const MINIMO_FRENO_GLOBAL = 5;

/**
 * La marca que hay que mostrar de una reserva, si tiene alguna pendiente.
 * Si tiene dos, gana la más grave: una cancelación tapa todo lo demás.
 */
export function cambioPendiente(
  cambios: { tipo: TipoCambio; estado: EstadoCambio }[] | null | undefined,
): TipoCambio | null {
  const pendientes = new Set(
    (cambios ?? []).filter((c) => c.estado === "pendiente").map((c) => c.tipo),
  );
  for (const tipo of ["posible_cancelacion", "cambio_depto", "cambio_fechas"] as const) {
    if (pendientes.has(tipo)) return tipo;
  }
  return null;
}

export function firmaCambio(
  tipo: TipoCambio,
  reserva: ReservaComparable,
  visto: VistoEnCalendario | undefined,
): string {
  switch (tipo) {
    case "posible_cancelacion":
      // La situación es "esta reserva, con estos datos, no está".
      return `cancelacion|${reserva.depto_id}|${reserva.fecha_checkin}|${reserva.fecha_checkout}`;
    case "cambio_fechas":
      return `fechas|${reserva.fecha_checkin}|${reserva.fecha_checkout}|${visto!.desde}|${visto!.hasta}`;
    case "cambio_depto":
      return `depto|${reserva.depto_id}|${visto!.depto_id}`;
  }
}

export function planificarCambios({
  reservas,
  vistos,
  marcas,
}: {
  /** Solo las de departamentos cuyo calendario se leyó bien. */
  reservas: ReservaComparable[];
  /** Todo lo que mostraron los calendarios leídos, de todos los deptos. */
  vistos: VistoEnCalendario[];
  /** Las marcas de esas reservas: pendientes y descartes activos. */
  marcas: MarcaExistente[];
}): PlanCambios {
  const plan: PlanCambios = {
    nuevas: [],
    actualizar: [],
    resueltasSolas: [],
    descartesVencidos: [],
    retenidas: [],
  };

  // El mismo código en dos calendarios (dos anuncios sincronizados entre sí):
  // se prefiere el del departamento de la reserva, que es el que no alarma.
  const vistosPorCodigo = new Map<string, VistoEnCalendario[]>();
  for (const v of vistos) {
    if (!vistosPorCodigo.has(v.codigo)) vistosPorCodigo.set(v.codigo, []);
    vistosPorCodigo.get(v.codigo)!.push(v);
  }

  const pendientes = new Map<string, MarcaExistente>();
  const descartes = new Map<string, MarcaExistente[]>();
  for (const m of marcas) {
    const clave = `${m.reserva_id}|${m.tipo}`;
    if (m.estado === "pendiente") pendientes.set(clave, m);
    else if (m.estado === "descartado" && m.activo) {
      if (!descartes.has(clave)) descartes.set(clave, []);
      descartes.get(clave)!.push(m);
    }
  }

  /** Qué situación tiene cada reserva, por tipo. */
  const situaciones = new Map<TipoCambio, { reserva: ReservaComparable; visto?: VistoEnCalendario }[]>([
    ["posible_cancelacion", []],
    ["cambio_fechas", []],
    ["cambio_depto", []],
  ]);
  const sinSituacion: { reserva: ReservaComparable; tipo: TipoCambio }[] = [];

  for (const reserva of reservas) {
    const candidatos = vistosPorCodigo.get(reserva.codigo_reserva) ?? [];
    const visto =
      candidatos.find((v) => v.depto_id === reserva.depto_id) ?? candidatos[0];

    if (!visto) {
      situaciones.get("posible_cancelacion")!.push({ reserva });
      sinSituacion.push({ reserva, tipo: "cambio_fechas" }, { reserva, tipo: "cambio_depto" });
      continue;
    }

    sinSituacion.push({ reserva, tipo: "posible_cancelacion" });

    if (visto.depto_id !== reserva.depto_id) {
      situaciones.get("cambio_depto")!.push({ reserva, visto });
    } else {
      sinSituacion.push({ reserva, tipo: "cambio_depto" });
    }

    if (visto.desde !== reserva.fecha_checkin || visto.hasta !== reserva.fecha_checkout) {
      situaciones.get("cambio_fechas")!.push({ reserva, visto });
    } else {
      sinSituacion.push({ reserva, tipo: "cambio_fechas" });
    }
  }

  // --- Lo que dejó de pasar: cierra pendientes y vence descartes ---
  for (const { reserva, tipo } of sinSituacion) {
    const clave = `${reserva.id}|${tipo}`;
    const pendiente = pendientes.get(clave);
    if (pendiente && pendiente.origen !== "excel") plan.resueltasSolas.push(pendiente.id);
    for (const d of descartes.get(clave) ?? []) plan.descartesVencidos.push(d.id);
  }

  // --- Frenos, solo para las posibles cancelaciones ---
  const desaparecidas = situaciones.get("posible_cancelacion")!;
  const retenidasIds = new Set<string>();

  const totalPorDepto = new Map<string, number>();
  for (const r of reservas) totalPorDepto.set(r.depto_id, (totalPorDepto.get(r.depto_id) ?? 0) + 1);
  const desaparecidasPorDepto = new Map<string, ReservaComparable[]>();
  for (const { reserva } of desaparecidas) {
    if (!desaparecidasPorDepto.has(reserva.depto_id)) desaparecidasPorDepto.set(reserva.depto_id, []);
    desaparecidasPorDepto.get(reserva.depto_id)!.push(reserva);
  }

  const frenoGlobal =
    desaparecidas.length >= MINIMO_FRENO_GLOBAL &&
    desaparecidas.length > reservas.length * PROPORCION_FRENO_GLOBAL;

  // Orden estable: el resultado no puede depender de cómo vino la consulta.
  for (const deptoId of [...desaparecidasPorDepto.keys()].sort()) {
    const delDepto = desaparecidasPorDepto.get(deptoId)!;
    const calendarioVacio =
      delDepto.length >= MINIMO_CALENDARIO_VACIO && delDepto.length === totalPorDepto.get(deptoId);
    if (!calendarioVacio && !frenoGlobal) continue;

    // Lo que ya tiene marca pendiente o descarte no se retiene: ya lo miró
    // (o lo está mirando) una persona.
    const aRetener = delDepto.filter((r) => {
      const clave = `${r.id}|posible_cancelacion`;
      if (pendientes.has(clave)) return false;
      const firma = firmaCambio("posible_cancelacion", r, undefined);
      return !(descartes.get(clave) ?? []).some((d) => d.firma === firma);
    });
    for (const r of delDepto) retenidasIds.add(r.id);
    if (aRetener.length > 0) {
      plan.retenidas.push({
        depto_id: deptoId,
        motivo: calendarioVacio ? "calendario_vacio" : "freno_global",
        reserva_ids: aRetener.map((r) => r.id).sort(),
      });
    }
  }

  // --- Marcas nuevas o actualizadas ---
  for (const [tipo, lista] of situaciones) {
    for (const { reserva, visto } of lista) {
      if (tipo === "posible_cancelacion" && retenidasIds.has(reserva.id)) continue;

      const clave = `${reserva.id}|${tipo}`;
      const firma = firmaCambio(tipo, reserva, visto);
      const marca: MarcaNueva = {
        reserva_id: reserva.id,
        tipo,
        firma,
        calendario_checkin: visto?.desde ?? null,
        calendario_checkout: visto?.hasta ?? null,
        calendario_depto_id: visto?.depto_id ?? null,
        reserva_checkin: reserva.fecha_checkin,
        reserva_checkout: reserva.fecha_checkout,
        reserva_depto_id: reserva.depto_id,
      };

      const pendiente = pendientes.get(clave);
      if (pendiente) {
        if (pendiente.firma !== firma) plan.actualizar.push({ id: pendiente.id, ...marca });
        continue;
      }

      // Alguien ya dijo que esta situación exacta no corresponde.
      if ((descartes.get(clave) ?? []).some((d) => d.firma === firma)) continue;

      plan.nuevas.push(marca);
    }
  }

  return plan;
}
