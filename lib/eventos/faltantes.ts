/**
 * Qué falta para dar por coordinado un check-in o check-out.
 *
 * Devuelve la lista de pendientes concretos ("falta el sobre", "falta el
 * candado Kennedy 3", "falta el horario"). Cuando la lista queda vacía, el
 * evento está listo. Función pura: tiene tests.
 */

import { METODOS_FISICOS } from "./etiquetas";

export type AccesoElegido = {
  clase: "punto" | "persona";
  metodo?: string;
  ubicacion?: string | null;
  identificador?: string | null;
};

/** Cómo se nombra un punto de acceso en el pendiente: "el sobre Talcahuano". */
function nombrarPunto(acceso: AccesoElegido): string {
  const nombres: Record<string, string> = {
    candado: "el candado",
    sobre: "el sobre",
    valijas: "las valijas",
    llaves: "las llaves",
  };
  const base = nombres[acceso.metodo ?? ""] ?? "el acceso";
  const detalle = [acceso.ubicacion, acceso.identificador].filter(Boolean).join(" ");
  return detalle ? `${base} ${detalle}` : base;
}

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
    faltan.push("falta definir cómo entra");
  } else if (
    tipo === "checkin" &&
    acceso.clase === "punto" &&
    METODOS_FISICOS.has(acceso.metodo ?? "") &&
    !accesoDejado
  ) {
    // En el check-out la llave la deja el huésped, no el equipo: no se pide.
    faltan.push(`falta dejar ${nombrarPunto(acceso)}`);
  }

  if (!horaCoordinada) faltan.push("falta el horario");

  if (tipo === "checkin") {
    if (requiereRegistro && !registroHecho) faltan.push("falta el registro");
    if (requiereAviso && !avisoHecho) faltan.push("falta el aviso a seguridad");
  }

  return faltan;
}
