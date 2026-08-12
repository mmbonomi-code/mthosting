/** Métodos de acceso a un departamento (spec §1.1 puntos_acceso). */
export const METODOS_ACCESO: Record<string, string> = {
  presencial: "Presencial",
  candado: "Candado",
  sobre: "Sobre",
  valijas: "Valijas",
  self: "Self",
  llaves: "Llaves",
};

/** Métodos donde hay una llave física que alguien deja o retira. */
export const METODOS_FISICOS = new Set(["candado", "sobre", "valijas", "llaves"]);

/**
 * Métodos donde el equipo tiene que ir a DEJAR algo antes de la llegada, y
 * por eso se pide confirmación. Las valijas quedan afuera: el huésped las
 * retira solo del guardado, no hay nada que el equipo deba dejar.
 */
export const METODOS_QUE_SE_DEJAN = new Set(["candado", "sobre", "llaves"]);

export const ESTADOS_EVENTO: Record<string, string> = {
  pendiente: "Pendiente",
  coordinado: "Coordinado",
  hecho: "Hecho",
  cancelado: "Cancelado",
};

/**
 * Cómo se coordinó el acceso, en una línea: "Sobre - Esmeralda",
 * "Candado - Kennedy 1 #2906", "Diego".
 *
 * Cuando va una persona no se aclara "Presencial": el nombre ya lo dice
 * (decisión del dueño, 12/08/2026). Si el punto presencial no tiene a quién
 * nombrar, ahí sí queda la palabra sola.
 */
export function describirAcceso(
  punto: { metodo: string; ubicacion: string | null; identificador: string | null } | null,
  persona: { nombre: string } | null,
): string | null {
  if (punto) {
    const donde = [punto.ubicacion, punto.identificador].filter(Boolean).join(" ");
    if (punto.metodo === "presencial") return donde || METODOS_ACCESO.presencial;
    const metodo = METODOS_ACCESO[punto.metodo] ?? punto.metodo;
    return donde ? `${metodo} - ${donde}` : metodo;
  }
  if (persona) return persona.nombre;
  return null;
}

/**
 * ¿Va una persona a abrir, o el huésped entra solo?
 *
 * Sirve para pintarlo distinto en la vista del día: lo presencial ocupa a
 * alguien del equipo y se mira antes (decisión del dueño, 12/08/2026).
 */
export function esAccesoPresencial(
  punto: { metodo: string } | null,
  persona: { nombre: string } | null,
): boolean {
  if (punto) return punto.metodo === "presencial";
  return persona !== null;
}

export const LLEGADA_DESDE: Record<string, string> = {
  depto: "Otro depto",
  eze: "Ezeiza",
  aep: "Aeroparque",
  bqb: "Buquebús",
};
