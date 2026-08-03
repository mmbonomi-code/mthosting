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

export const ESTADOS_EVENTO: Record<string, string> = {
  pendiente: "Pendiente",
  coordinado: "Coordinado",
  hecho: "Hecho",
  cancelado: "Cancelado",
};

/**
 * Cómo se coordinó el acceso, en una línea: "Sobre - Esmeralda",
 * "Candado - Kennedy 1 #2906", "Presencial - Maguie".
 */
export function describirAcceso(
  punto: { metodo: string; ubicacion: string | null; identificador: string | null } | null,
  persona: { nombre: string } | null,
): string | null {
  if (punto) {
    const donde = [punto.ubicacion, punto.identificador].filter(Boolean).join(" ");
    const metodo = METODOS_ACCESO[punto.metodo] ?? punto.metodo;
    return donde ? `${metodo} - ${donde}` : metodo;
  }
  if (persona) return `Presencial - ${persona.nombre}`;
  return null;
}

export const LLEGADA_DESDE: Record<string, string> = {
  depto: "Otro depto",
  eze: "Ezeiza",
  aep: "Aeroparque",
  bqb: "Buquebús",
};
