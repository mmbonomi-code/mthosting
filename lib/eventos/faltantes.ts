/**
 * Qué falta para dar por coordinado un check-in o check-out.
 *
 * Devuelve etiquetas cortas y en imperativo ("dejar sobre", "definir
 * horario"), pensadas para leerse de un vistazo en la lista del día. Cuando
 * la lista queda vacía, el evento está coordinado. Función pura: tiene tests.
 */

import { METODOS_FISICOS } from "./etiquetas";

export type AccesoElegido = {
  clase: "punto" | "persona";
  metodo?: string;
};

/** "dejar sobre", "dejar candado"… El dónde ya se ve en la fila. */
const ACCION_POR_METODO: Record<string, string> = {
  candado: "dejar candado",
  sobre: "dejar sobre",
  valijas: "dejar valijas",
  llaves: "dejar llaves",
};

export function faltantesDeEvento({
  tipo,
  horaCoordinada,
  acceso,
  accesoDejado,
  requiereRegistro,
  registroHecho,
  requiereAviso,
  avisoHecho,
}: {
  tipo: "checkin" | "checkout";
  horaCoordinada: string | null;
  acceso: AccesoElegido | null;
  accesoDejado: boolean;
  requiereRegistro: boolean;
  registroHecho: boolean;
  requiereAviso: boolean;
  avisoHecho: boolean;
}): string[] {
  const faltan: string[] = [];

  if (!acceso) {
    faltan.push("coordinar");
  } else if (
    tipo === "checkin" &&
    acceso.clase === "punto" &&
    METODOS_FISICOS.has(acceso.metodo ?? "") &&
    !accesoDejado
  ) {
    // En el check-out la llave la deja el huésped, no el equipo: no se pide.
    faltan.push(ACCION_POR_METODO[acceso.metodo ?? ""] ?? "dejar acceso");
  }

  if (!horaCoordinada) faltan.push("definir horario");

  if (tipo === "checkin") {
    if (requiereRegistro && !registroHecho) faltan.push("registro");
    if (requiereAviso && !avisoHecho) faltan.push("aviso seguridad");
  }

  return faltan;
}
