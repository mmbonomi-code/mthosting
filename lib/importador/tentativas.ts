/**
 * Subir el Excel de tentativas completado (decisión del dueño, 13/09/2026).
 * El Excel sale de lib/exportar/tentativas.ts.
 *
 * Funciones PURAS, con tests: leer las filas y decidir qué hacer con cada
 * una. La base la toca lib/importador/ejecutarTentativas.ts.
 *
 * Las reglas:
 *
 *  - La fila se cruza SIEMPRE por código de reserva. Fechas, departamento y
 *    el resto de las columnas de referencia se ignoran.
 *  - Todo o nada: si el archivo no es este Excel o tiene un valor inválido,
 *    no se aplica ninguna fila. Un código que no existe o una reserva ya
 *    cancelada no son errores del archivo: se saltean y se avisan.
 *  - Manda el Excel: un dato distinto reemplaza al guardado. Una celda vacía
 *    nunca borra nada (CLAUDE.md, regla 4).
 *  - Con teléfono, la reserva deja de ser tentativa.
 *  - "Cancelada":
 *      · si el calendario ya la marcó "¿Cancelada?", se cancela;
 *      · si el calendario todavía la muestra, NO se cancela: queda marcada
 *        para confirmar en Alertas.
 *    En una fila "Cancelada" no se actualizan nombre ni contacto: Airbnb los
 *    recorta al cancelar (regla del dueño del 02/08/2026, spec §2.5).
 *  - "Confirmada" en una marcada "¿Cancelada?" equivale a "Sigue en pie".
 *  - Estado vacío: el estado no se toca.
 */

import { corregirContactoAR } from "../telefono";
import { ENCABEZADOS_TENTATIVAS } from "../exportar/tentativas";
import { ErrorImportacion } from "./parser";

export type EstadoExcel = "confirmada" | "cancelada";

export type FilaExcel = {
  /** Número de fila en el Excel, para poder decir dónde está el problema. */
  fila: number;
  codigo: string;
  estado: EstadoExcel | null;
  huesped_nombre: string | null;
  huesped_contacto: string | null;
  adultos: number | null;
  ninos: number | null;
  bebes: number | null;
};

/** Las columnas que se leen. El resto del Excel es de referencia. */
const COLUMNAS_LEIDAS = [
  "Código",
  "Estado en Airbnb",
  "Nombre del huésped",
  "Teléfono",
  "Adultos",
  "Niños",
  "Bebés",
] as const satisfies readonly (typeof ENCABEZADOS_TENTATIVAS)[number][];

function texto(valor: string | undefined): string | null {
  const limpio = (valor ?? "").trim();
  return limpio === "" ? null : limpio;
}

/**
 * Un teléfono como lo deja Excel o un scraping: `+54 11 5555-1234`,
 * `5491155551234` (sin el +, porque Excel lo convirtió en número), etc. Se
 * guarda legible, con el + y con el 9 de los móviles argentinos.
 */
export function normalizarContactoExcel(valor: string | null): string | null {
  if (!valor) return null;
  const conMas = /^\d{8,}$/.test(valor) ? `+${valor}` : valor;
  return corregirContactoAR(conMas);
}

/**
 * Lee las filas del Excel (la primera, los encabezados). Si hay cualquier
 * error, lanza ErrorImportacion con TODOS juntos: que se corrijan de una vez.
 */
export function leerExcelTentativas(filas: string[][]): FilaExcel[] {
  const [encabezados = [], ...datos] = filas;
  const indice = new Map(encabezados.map((e, i) => [(e ?? "").trim(), i]));

  const faltan = COLUMNAS_LEIDAS.filter((c) => !indice.has(c));
  if (faltan.length > 0) {
    throw new ErrorImportacion(
      `Este archivo no es el Excel de tentativas: le faltan las columnas ${faltan
        .map((c) => `"${c}"`)
        .join(", ")}. Descargalo de nuevo desde Exportar.`,
    );
  }

  const celda = (fila: string[], columna: (typeof COLUMNAS_LEIDAS)[number]) =>
    fila[indice.get(columna)!];

  const errores: string[] = [];
  const leidas: FilaExcel[] = [];
  const vistos = new Map<string, number>();

  datos.forEach((fila, i) => {
    const numero = i + 2;
    const valores = COLUMNAS_LEIDAS.map((c) => texto(celda(fila, c)));
    // Las filas vacías del final que deja Excel no son un error.
    if (valores.every((v) => v === null)) return;

    const codigo = texto(celda(fila, "Código"))?.toUpperCase() ?? null;
    if (!codigo || !/^[A-Z0-9]{8,12}$/.test(codigo)) {
      errores.push(`Fila ${numero}: el código "${codigo ?? ""}" no es un código de reserva válido.`);
      return;
    }
    if (vistos.has(codigo)) {
      errores.push(`Fila ${numero}: ${codigo} ya aparece en la fila ${vistos.get(codigo)}.`);
      return;
    }
    vistos.set(codigo, numero);

    const estadoTexto = texto(celda(fila, "Estado en Airbnb"))?.toLowerCase() ?? null;
    let estado: EstadoExcel | null = null;
    if (estadoTexto === "confirmada" || estadoTexto === "cancelada") estado = estadoTexto;
    else if (estadoTexto !== null) {
      errores.push(
        `Fila ${numero} (${codigo}): el estado "${celda(fila, "Estado en Airbnb")}" no existe. Tiene que ser Confirmada, Cancelada o quedar vacío.`,
      );
    }

    const cantidad = (columna: "Adultos" | "Niños" | "Bebés"): number | null => {
      const valor = texto(celda(fila, columna));
      if (valor === null) return null;
      const n = Number(valor.replace(",", "."));
      if (!Number.isInteger(n) || n < 0 || n > 50) {
        errores.push(`Fila ${numero} (${codigo}): "${valor}" no es una cantidad válida de ${columna.toLowerCase()}.`);
        return null;
      }
      return n;
    };

    leidas.push({
      fila: numero,
      codigo,
      estado,
      huesped_nombre: texto(celda(fila, "Nombre del huésped")),
      huesped_contacto: normalizarContactoExcel(texto(celda(fila, "Teléfono"))),
      adultos: cantidad("Adultos"),
      ninos: cantidad("Niños"),
      bebes: cantidad("Bebés"),
    });
  });

  if (errores.length > 0) throw new ErrorImportacion(errores.join("\n"));
  return leidas;
}

export type ReservaParaExcel = {
  id: string;
  codigo_reserva: string;
  cancelada: boolean;
  descartada: boolean;
  datos_completos: boolean;
  huesped_nombre: string | null;
  huesped_contacto: string | null;
  adultos: number | null;
  ninos: number | null;
  bebes: number | null;
};

/** Posible cancelación pendiente de la reserva, y quién la marcó. */
export type MarcaCancelacion = { id: string; origen: "calendario" | "excel" };

export type CambiosExcel = Partial<{
  huesped_nombre: string;
  huesped_contacto: string;
  adultos: number;
  ninos: number;
  bebes: number;
  datos_completos: boolean;
}>;

export type AccionExcel =
  | { tipo: "cancelar"; marca_id: string }
  | { tipo: "marcar_cancelacion" }
  | { tipo: "sigue_en_pie"; marca_id: string };

export type DecisionExcel = {
  codigo: string;
  reserva_id: string | null;
  cambios: CambiosExcel;
  accion: AccionExcel | null;
  aviso: string | null;
};

function tieneAlgo(fila: FilaExcel): boolean {
  return (
    fila.estado !== null ||
    fila.huesped_nombre !== null ||
    fila.huesped_contacto !== null ||
    fila.adultos !== null ||
    fila.ninos !== null ||
    fila.bebes !== null
  );
}

export function decidirFilaExcel(
  fila: FilaExcel,
  reserva: ReservaParaExcel | undefined,
  marca: MarcaCancelacion | undefined,
): DecisionExcel {
  const decision: DecisionExcel = {
    codigo: fila.codigo,
    reserva_id: reserva?.id ?? null,
    cambios: {},
    accion: null,
    aviso: null,
  };

  if (!reserva) {
    if (tieneAlgo(fila)) decision.aviso = `${fila.codigo}: no existe en el sistema. Se salteó.`;
    return decision;
  }
  if (reserva.cancelada) {
    if (tieneAlgo(fila) && fila.estado !== "cancelada") {
      decision.aviso = `${fila.codigo}: ya está cancelada, y la cancelación no se revierte. Se salteó.`;
    }
    return decision;
  }
  if (reserva.descartada) {
    if (tieneAlgo(fila)) decision.aviso = `${fila.codigo}: está descartada. Se salteó.`;
    return decision;
  }

  /** Manda el Excel, pero un vacío nunca borra. */
  const proponer = <C extends "huesped_nombre" | "huesped_contacto" | "adultos" | "ninos" | "bebes">(
    campo: C,
    nuevo: ReservaParaExcel[C],
  ) => {
    if (nuevo !== null && nuevo !== reserva[campo]) {
      (decision.cambios as Record<string, unknown>)[campo] = nuevo;
    }
  };

  if (fila.estado !== "cancelada") {
    proponer("huesped_nombre", fila.huesped_nombre);
    proponer("huesped_contacto", fila.huesped_contacto);
  }
  proponer("adultos", fila.adultos);
  proponer("ninos", fila.ninos);
  proponer("bebes", fila.bebes);

  if (!reserva.datos_completos && (decision.cambios.huesped_contacto ?? reserva.huesped_contacto)) {
    decision.cambios.datos_completos = true;
  }

  if (fila.estado === "cancelada") {
    if (marca?.origen === "calendario") {
      decision.accion = { tipo: "cancelar", marca_id: marca.id };
    } else if (!marca) {
      decision.accion = { tipo: "marcar_cancelacion" };
    }
    // Una marca que ya pidió el Excel sigue esperando en Alertas: subir el
    // mismo archivo otra vez no la cancela ni la duplica.
  } else if (fila.estado === "confirmada" && marca) {
    decision.accion = { tipo: "sigue_en_pie", marca_id: marca.id };
  }

  return decision;
}
