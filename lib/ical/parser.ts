/**
 * Parser del calendario iCal de Airbnb (spec §2.12).
 *
 * EL RIESGO PRINCIPAL de esta funcionalidad: las líneas largas del formato
 * iCal se parten con CRLF + un espacio, y el código de reserva queda cortado
 * al medio (`...de` / ` tails/HM...`). Un parser que no una esas líneas ANTES
 * de buscar encuentra CERO códigos y NO lanza ningún error: falla en
 * silencio. Por eso lo primero que se hace es desdoblar.
 */

export type EventoICal = {
  tipo: "reserva" | "bloqueo";
  /** Solo las reservas traen código. */
  codigo: string | null;
  /** Últimos 4 dígitos del teléfono, cuando vienen. */
  telefono4: string | null;
  /** Fechas de negocio, `yyyy-mm-dd`. */
  desde: string;
  hasta: string;
  resumen: string;
};

export type ResultadoICal = {
  reservas: EventoICal[];
  bloqueos: EventoICal[];
  /** Eventos que se saltearon, con el motivo. Nunca se descartan en silencio. */
  salteados: string[];
};

/**
 * Desdobla las líneas partidas del formato iCal (RFC 5545): un salto de
 * línea seguido de un espacio o tabulación es una continuación, no una
 * línea nueva.
 */
export function desdoblar(texto: string): string {
  return texto.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "");
}

/** `20260726` → `2026-07-26`. */
function fechaICal(valor: string): string | null {
  const m = valor.match(/^(\d{4})(\d{2})(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

export function parsearICal(contenido: string): ResultadoICal {
  // PRIMERO desdoblar. Todo lo demás depende de esto.
  const texto = desdoblar(contenido);

  const reservas: EventoICal[] = [];
  const bloqueos: EventoICal[] = [];
  const salteados: string[] = [];

  const bloquesEvento = texto.split("BEGIN:VEVENT").slice(1);

  for (const bloque of bloquesEvento) {
    const cuerpo = bloque.split("END:VEVENT")[0];

    const desde = fechaICal(cuerpo.match(/DTSTART[^:]*:(\S+)/)?.[1] ?? "");
    const hasta = fechaICal(cuerpo.match(/DTEND[^:]*:(\S+)/)?.[1] ?? "");
    const resumen = (cuerpo.match(/SUMMARY:(.*)/)?.[1] ?? "").trim();
    const descripcion = cuerpo.match(/DESCRIPTION:(.*)/)?.[1] ?? "";

    if (!desde || !hasta) {
      salteados.push(`Evento sin fechas legibles (${resumen || "sin resumen"})`);
      continue;
    }

    // "Airbnb (Not available)" es un bloqueo manual del calendario: no trae
    // código ni teléfono y no es una reserva.
    const esBloqueo = /not available/i.test(resumen);
    if (esBloqueo) {
      bloqueos.push({ tipo: "bloqueo", codigo: null, telefono4: null, desde, hasta, resumen });
      continue;
    }

    const codigo = descripcion.match(/details\/([A-Z0-9]{8,12})/)?.[1] ?? null;
    if (!codigo) {
      // Sin código no se crea nada: una reserva sin código es incontrolable.
      salteados.push(
        `Evento "${resumen}" del ${desde} sin código de reserva legible`,
      );
      continue;
    }

    const telefono4 = descripcion.match(/Last 4 Digits\):?\s*(\d{4})/)?.[1] ?? null;

    reservas.push({ tipo: "reserva", codigo, telefono4, desde, hasta, resumen });
  }

  return { reservas, bloqueos, salteados };
}
