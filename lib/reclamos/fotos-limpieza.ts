/**
 * Las fotos que la limpieza cargó en el check-out de una reserva
 * (docs/FASE-1-RECLAMOS-ESPECIFICACION.md §6).
 *
 * Al crear un reclamo se adjuntan solas, marcadas con origen "limpieza".
 * Maguie puede sacar las que no sirvan y agregar otras.
 *
 * El módulo de limpieza (Fase 2) todavía no existe, así que hoy devuelve una
 * lista vacía. Toda la conexión con ese módulo pasa por acá: cuando exista,
 * se cambia SOLO esta función y el resto del sistema no se entera.
 */

export type FotoLimpieza = {
  storage_path: string;
  tomada_at: string | null;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function fotosDeLimpieza(reservaId: string): Promise<FotoLimpieza[]> {
  return [];
}
