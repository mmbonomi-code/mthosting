/**
 * Reglas de la asignación de responsables, separadas de la base para poder
 * probarlas.
 */

import type { Database } from "@/lib/database.types";

export type EstadoLimpieza = Database["public"]["Enums"]["limpieza_estado"];

/**
 * En qué estado queda una limpieza cuando se le quita el responsable.
 *
 * Vuelve a `pendiente`, que es lo que corresponde: sin nadie asignado, está
 * esperando que alguien la tome. La excepción es una limpieza CANCELADA:
 * quitarle el responsable no puede revivirla.
 *
 * Pasó de verdad (ED TALC 12 del 26/08, el 28/08/2026): se canceló a mano y
 * diez segundos después volvió a `pendiente` sola, porque le soltaron la
 * persona asignada. Reapareció en la lista sin que nadie decidiera nada, y
 * además perdió el monto pactado.
 */
export function estadoAlQuitarResponsable(estado: EstadoLimpieza): EstadoLimpieza {
  return estado === "cancelada" ? "cancelada" : "pendiente";
}
