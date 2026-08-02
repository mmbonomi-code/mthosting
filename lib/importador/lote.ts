/**
 * Lógica del lote de importación (spec §2.5–§2.7), separada de la base de
 * datos para poder testearla. Acá viven las reglas delicadas:
 *
 * - Orden de archivos por el timestamp del nombre; el más reciente gana.
 * - Nunca pisar un valor existente con uno vacío.
 * - En cancelaciones, nombre y contacto no se tocan (decisión del dueño).
 * - `cancelada` es terminal: nunca se revierte, se registra anomalía.
 * - `descartada` vuelve a false si la reserva reaparece.
 */

import {
  type FilaReserva,
  parsearArchivoReservas,
  timestampDeNombre,
} from "./parser";

export type ArchivoLote = { nombre: string; contenido: string };

export type ResultadoLote = {
  /** Filas finales, una por código: la del archivo más reciente. */
  filas: FilaReserva[];
  advertencias: string[];
};

/**
 * Parsea y consolida un lote de archivos. Si CUALQUIER archivo está roto,
 * lanza error: transaccional por lote, nada a medio importar.
 */
export function consolidarLote(archivos: ArchivoLote[]): ResultadoLote {
  const advertencias: string[] = [];

  // Orden cronológico por nombre; los irreconocibles van al final.
  const ordenados = archivos
    .map((archivo) => {
      const ts = timestampDeNombre(archivo.nombre);
      if (ts === null) {
        advertencias.push(
          `"${archivo.nombre}" no tiene fecha reconocible en el nombre: se procesa al final del lote.`,
        );
      }
      return { ...archivo, ts };
    })
    .sort((a, b) => (a.ts ?? "9999").localeCompare(b.ts ?? "9999"));

  // El mismo código en varios archivos: gana el más reciente (el último).
  const porCodigo = new Map<string, FilaReserva>();
  for (const archivo of ordenados) {
    for (const fila of parsearArchivoReservas(archivo.contenido)) {
      porCodigo.set(fila.codigo_reserva, fila);
    }
  }

  return { filas: [...porCodigo.values()], advertencias };
}

/** Lo que se necesita saber de una reserva ya guardada para decidir el upsert. */
export type ReservaExistente = {
  id: string;
  cancelada: boolean;
  descartada: boolean;
  datos_completos: boolean;
  depto_id: string | null;
  huesped_nombre: string | null;
  huesped_contacto: string | null;
  adultos: number | null;
  ninos: number | null;
  bebes: number | null;
  noches: number | null;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  fecha_reservada: string | null;
  listing_nombre_raw: string | null;
  payout_monto: number | null;
};

export type CambiosReserva = Partial<{
  huesped_nombre: string;
  huesped_contacto: string;
  adultos: number;
  ninos: number;
  bebes: number;
  noches: number;
  fecha_checkin: string;
  fecha_checkout: string;
  fecha_reservada: string;
  listing_nombre_raw: string;
  payout_monto: number;
  cancelada: boolean;
  descartada: boolean;
  datos_completos: boolean;
  depto_id: string;
}>;

export type DecisionUpsert =
  | {
      tipo: "nueva";
      datos: {
        codigo_reserva: string;
        canal: "airbnb";
        origen: "csv";
        datos_completos: boolean;
        depto_id: string | null;
        listing_nombre_raw: string;
        huesped_nombre: string | null;
        huesped_contacto: string | null;
        adultos: number | null;
        ninos: number | null;
        bebes: number | null;
        noches: number | null;
        fecha_checkin: string;
        fecha_checkout: string;
        fecha_reservada: string | null;
        cancelada: boolean;
        payout_monto: number | null;
        payout_moneda: string;
      };
    }
  | {
      tipo: "actualizada" | "sin_cambios";
      id: string;
      cambios: CambiosReserva;
      anomalias: string[];
      reaparecida: boolean;
      cancelacionDetectada: boolean;
    };

/**
 * Decide qué hacer con UNA fila del lote contra lo que ya hay en la base.
 * No toca la base: devuelve la decisión, que la capa de arriba aplica.
 */
export function decidirUpsert(
  fila: FilaReserva,
  existente: ReservaExistente | null,
  deptoDeAlias: string | null,
): DecisionUpsert {
  if (existente === null) {
    return {
      tipo: "nueva",
      datos: {
        codigo_reserva: fila.codigo_reserva,
        canal: "airbnb",
        origen: "csv",
        datos_completos: true,
        depto_id: deptoDeAlias,
        listing_nombre_raw: fila.listing_nombre_raw,
        huesped_nombre: fila.huesped_nombre,
        huesped_contacto: fila.huesped_contacto,
        adultos: fila.adultos,
        ninos: fila.ninos,
        bebes: fila.bebes,
        noches: fila.noches,
        fecha_checkin: fila.fecha_checkin,
        fecha_checkout: fila.fecha_checkout,
        fecha_reservada: fila.fecha_reservada,
        cancelada: fila.cancelada,
        payout_monto: fila.payout_monto,
        payout_moneda: "USD",
      },
    };
  }

  const cambios: CambiosReserva = {};
  const anomalias: string[] = [];

  /** Asigna solo si el valor nuevo no es null y difiere: nunca pisar con vacío. */
  const proponer = <C extends keyof CambiosReserva>(
    campo: C,
    nuevo: CambiosReserva[C] | null,
    actual: CambiosReserva[C] | null,
  ) => {
    if (nuevo !== null && nuevo !== undefined && nuevo !== actual) {
      cambios[campo] = nuevo;
    }
  };

  // Nombre y contacto: en una fila cancelada NO se actualizan jamás
  // (Airbnb recorta el nombre y borra el teléfono al cancelar).
  if (!fila.cancelada) {
    proponer("huesped_nombre", fila.huesped_nombre, existente.huesped_nombre);
    proponer("huesped_contacto", fila.huesped_contacto, existente.huesped_contacto);
  }

  proponer("adultos", fila.adultos, existente.adultos);
  proponer("ninos", fila.ninos, existente.ninos);
  proponer("bebes", fila.bebes, existente.bebes);
  proponer("noches", fila.noches, existente.noches);
  proponer("fecha_checkin", fila.fecha_checkin, existente.fecha_checkin);
  proponer("fecha_checkout", fila.fecha_checkout, existente.fecha_checkout);
  proponer("fecha_reservada", fila.fecha_reservada, existente.fecha_reservada);
  proponer("listing_nombre_raw", fila.listing_nombre_raw || null, existente.listing_nombre_raw);
  proponer("payout_monto", fila.payout_monto, existente.payout_monto);

  // Cancelación: false→true se aplica; true→false NUNCA se revierte.
  let cancelacionDetectada = false;
  if (fila.cancelada && !existente.cancelada) {
    cambios.cancelada = true;
    cancelacionDetectada = true;
  } else if (!fila.cancelada && existente.cancelada) {
    anomalias.push(
      `${fila.codigo_reserva}: el archivo la trae sin marca de cancelación, pero acá figura cancelada. ` +
        `La cancelación es terminal: no se revierte. (Estado del archivo: "${fila.estado_raw}")`,
    );
  }

  // Reserva descartada que sigue existiendo en Airbnb: reaparece.
  let reaparecida = false;
  if (existente.descartada) {
    cambios.descartada = false;
    reaparecida = true;
  }

  // El depto solo se completa si faltaba: un mapeo manual nunca se pisa.
  if (existente.depto_id === null && deptoDeAlias !== null) {
    cambios.depto_id = deptoDeAlias;
  }

  // Una reserva tentativa del iCal queda completa cuando el CSV trae contacto.
  if (!existente.datos_completos && (fila.huesped_contacto || existente.huesped_contacto)) {
    cambios.datos_completos = true;
  }

  return {
    tipo: Object.keys(cambios).length > 0 ? "actualizada" : "sin_cambios",
    id: existente.id,
    cambios,
    anomalias,
    reaparecida,
    cancelacionDetectada,
  };
}
