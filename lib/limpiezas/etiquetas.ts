/** Tipos de limpieza, en el orden en que se ofrecen (spec §3.2). */
export const TIPOS_LIMPIEZA: Record<string, string> = {
  normal: "Normal (salida)",
  repaso: "Repaso",
  inicial: "Inicial",
  cambio_blancos: "Cambio de blancos",
  con_huespedes: "Con huéspedes",
  desmantelar: "Desmantelar",
  propietario: "Propietario",
};

export const ESTADOS_LIMPIEZA: Record<string, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  en_curso: "En curso",
  hecha: "Hecha",
  verificada: "Verificada",
  cancelada: "Cancelada",
};

/** `14:30:00` → `14:30`. Vacío si no hay hora cargada. */
export function formatearHora(hora: string | null | undefined): string | null {
  if (!hora) return null;
  return hora.slice(0, 5);
}
