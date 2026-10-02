/**
 * El día de logística: qué hay que llevar, qué hay que sacar y dónde hay que
 * dejar una llave (decisión del dueño, 02/10/2026).
 *
 * Funciones puras, con tests. La pantalla trae los datos y pregunta acá.
 */

import type { EstadoEquipamiento, TipoEquipamiento } from "@/lib/reporte/equipamiento";

// ---------------------------------------------------------------------------
// Quién ve la pantalla
// ---------------------------------------------------------------------------

/**
 * Logística, y el back office que la cubre cuando falta. Es la misma lista
 * que `puede_hacer_logistica()` en la base: si se separan, aparece un botón
 * que da error al tocarlo.
 */
const ROLES = ["admin", "manager", "coordinador", "logistica"] as const;

export function rolPuedeVerLogistica(rol: string | null): boolean {
  return rol !== null && (ROLES as readonly string[]).includes(rol);
}

// ---------------------------------------------------------------------------
// Llaves
// ---------------------------------------------------------------------------

/**
 * ¿Esta llegada le toca a logística? Solo las de candado: es la única forma
 * de entrar en la que alguien tiene que ir antes a dejar la llave y nadie
 * del equipo está ahí cuando llega el huésped.
 */
export function esLlegadaConCandado(e: {
  tipo: string;
  punto: { metodo: string } | null;
  reserva: { cancelada: boolean; descartada: boolean } | null;
}): boolean {
  return (
    e.tipo === "checkin" &&
    e.punto?.metodo === "candado" &&
    !!e.reserva &&
    !e.reserva.cancelada &&
    !e.reserva.descartada
  );
}

// ---------------------------------------------------------------------------
// Horarios de la limpieza
// ---------------------------------------------------------------------------

/**
 * Los horarios de salida y de entrada de ese día salen de la coordinación
 * del check-in/out, con la misma cuenta que "Mis limpiezas"
 * (`lib/limpiezas/interaccion-db.ts`). Lo que falta acá es cuándo entra
 * alguien si NO es ese día: así logística sabe si hay margen.
 *
 * `prox_checkin` es fecha y hora local sin zona; la hora guardada ahí no es
 * confiable (viene 00:00 cuando no se coordinó), así que se usa solo el día.
 * Null si la próxima entrada es ese mismo día —eso ya lo dice el horario— o
 * si no hay ninguna.
 */
export function diaProximaEntrada(
  proxCheckin: string | null,
  fechaLimpieza: string,
): string | null {
  if (!proxCheckin) return null;
  const fecha = proxCheckin.slice(0, 10);
  if (fecha <= fechaLimpieza) return null;
  const [, m, d] = fecha.split("-");
  return `${d}/${m}`;
}

// ---------------------------------------------------------------------------
// Cunas y sillas
// ---------------------------------------------------------------------------

export type AccionEquipamiento = "llevar" | "retirar";

export type TareaEquipamiento = {
  accion: AccionEquipamiento;
  hecha: boolean;
  /**
   * No se puede marcar todavía. Pasa en un pedido de un solo día: hasta que
   * no se lleva, no hay nada que retirar.
   */
  bloqueada: boolean;
};

/**
 * Qué tiene que hacer logística con un equipo ese día. Solo el día que
 * empieza (llevar) y el día que termina (retirar), como en el Día (decisión
 * del dueño, 22/09/2026). A diferencia del Día, lo ya hecho también aparece,
 * tachado y con la posibilidad de deshacerlo: un toque equivocado no puede
 * hacer desaparecer la tarea.
 */
export function tareasEquipamiento(
  e: { estado: EstadoEquipamiento; fecha_desde: string; fecha_hasta: string },
  dia: string,
): TareaEquipamiento[] {
  const tareas: TareaEquipamiento[] = [];
  if (e.fecha_desde === dia) {
    tareas.push({ accion: "llevar", hecha: e.estado !== "pedido", bloqueada: false });
  }
  if (e.fecha_hasta === dia) {
    tareas.push({
      accion: "retirar",
      hecha: e.estado === "retirado",
      bloqueada: e.estado === "pedido",
    });
  }
  return tareas;
}

/** El estado al que pasa el equipo al marcar (o desmarcar) una tarea. */
export function estadoTrasMarcar(
  accion: AccionEquipamiento,
  hecha: boolean,
): EstadoEquipamiento {
  if (accion === "llevar") return hecha ? "entregado" : "pedido";
  return hecha ? "retirado" : "entregado";
}

export const TEXTO_ACCION: Record<AccionEquipamiento, { pendiente: string; hecha: string }> = {
  llevar: { pendiente: "Llevar", hecha: "Entregada" },
  retirar: { pendiente: "Retirar", hecha: "Retirada" },
};

export type { TipoEquipamiento };
