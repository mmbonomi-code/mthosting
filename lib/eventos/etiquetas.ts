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

export const LLEGADA_DESDE: Record<string, string> = {
  depto: "Otro depto",
  eze: "Ezeiza",
  aep: "Aeroparque",
  bqb: "Buquebús",
};
