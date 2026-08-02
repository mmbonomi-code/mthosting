/**
 * Parser del CSV de reservas de Airbnb (spec §2.1–§2.4).
 *
 * Funciones puras, sin base de datos: todo lo de acá tiene test en
 * parser.test.ts. Las reglas están validadas contra los exports reales
 * (1.014 archivos, 02/08/2026), no solo contra la spec.
 */

/** Error de parseo: rechaza el archivo entero, nunca "importar lo que se pueda". */
export class ErrorImportacion extends Error {}

export const ENCABEZADO_ESPERADO = [
  "Código de confirmación",
  "Estado",
  "Nombre del huésped",
  "Contacto",
  "Número de adultos",
  "Número de niños",
  "Número de bebés",
  "Fecha de inicio",
  "Fecha de finalización",
  "Número de noches",
  "Reservada",
  "Anuncio",
  "Ganancias",
] as const;

export type FilaReserva = {
  codigo_reserva: string;
  /** Texto crudo de la columna Estado. NO es un estado: no se persiste como tal. */
  estado_raw: string;
  cancelada: boolean;
  huesped_nombre: string | null;
  huesped_contacto: string | null;
  adultos: number | null;
  ninos: number | null;
  bebes: number | null;
  noches: number | null;
  fecha_checkin: string;
  fecha_checkout: string;
  fecha_reservada: string | null;
  listing_nombre_raw: string;
  payout_monto: number | null;
  payout_moneda: "USD";
  /** La fila original completa, siempre. */
  raw: Record<string, string>;
};

/** Parser CSV: comillas, comillas escapadas (""), CRLF y saltos dentro de campos. */
export function parsearCSV(texto: string): string[][] {
  // BOM de UTF-8, si viene.
  if (texto.charCodeAt(0) === 0xfeff) texto = texto.slice(1);

  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;

  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          enComillas = false;
        }
      } else {
        campo += c;
      }
    } else if (c === '"') {
      enComillas = true;
    } else if (c === ",") {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (c !== "\r") {
      campo += c;
    }
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  // Filas totalmente vacías (línea final, etc.) no cuentan.
  return filas.filter((f) => f.some((v) => v.trim() !== ""));
}

/**
 * Ganancias → número, decidido VALOR POR VALOR (nunca por archivo):
 *
 * - `$ 93,53` (espacio duro  ) → 93.53
 * - `$102,25` (formato viejo, sin espacio) → 102.25
 * - `$ 1.234,56` → 1234.56 (si hay coma, los puntos son miles)
 * - `$ 0.00` → 0 (sin coma, el punto es decimal)
 * - `-$ 50,00` → -50 (penalidad por cancelación del anfitrión)
 * - vacío → null (nunca 0: un vacío no es un dato)
 */
export function parsearGanancias(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === "") return null;

  const negativo = limpio.startsWith("-");
  const numero = limpio.replace(/^-?\$[\s ]*/, "").replace(/[\s ]/g, "");

  if (!/^[\d.,]+$/.test(numero) || numero === "") {
    throw new ErrorImportacion(`Ganancias con formato desconocido: "${texto}"`);
  }

  const normalizado = numero.includes(",")
    ? numero.replace(/\./g, "").replace(",", ".")
    : numero;

  const valor = Number.parseFloat(normalizado);
  if (Number.isNaN(valor)) {
    throw new ErrorImportacion(`Ganancias con formato desconocido: "${texto}"`);
  }
  return negativo ? -valor : valor;
}

/**
 * Fecha `d/m/yyyy` sin ceros a la izquierda → `yyyy-mm-dd`.
 * SIEMPRE día primero: `5/7/2026` es 5 de julio, jamás 7 de mayo.
 */
export function parsearFechaDMA(texto: string): string {
  const m = texto.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) {
    throw new ErrorImportacion(`Fecha con formato desconocido: "${texto}" (se espera d/m/aaaa)`);
  }
  const [, d, mes, a] = m;
  const dia = Number(d);
  const mesN = Number(mes);
  const anio = Number(a);

  // Valida que la fecha exista de verdad (31/2 no pasa).
  const fecha = new Date(Date.UTC(anio, mesN - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio ||
    fecha.getUTCMonth() !== mesN - 1 ||
    fecha.getUTCDate() !== dia
  ) {
    throw new ErrorImportacion(`Fecha inexistente: "${texto}"`);
  }

  return `${anio}-${String(mesN).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** Fecha ISO `yyyy-mm-dd` (columna "Reservada"). Vacía → null. */
export function parsearFechaISO(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(limpio)) {
    throw new ErrorImportacion(`Fecha con formato desconocido: "${texto}" (se espera aaaa-mm-dd)`);
  }
  return limpio;
}

/**
 * La columna Estado NO es un estado (§2.4): solo se extrae si es cancelación.
 * Cubre "Cancelación por parte del viajero", "Cancelada por Airbnb" y
 * "Cancelada por vos".
 */
export function esCancelada(estadoRaw: string): boolean {
  return /cancel/i.test(estadoRaw);
}

function enteroONulo(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === "") return null;
  const n = Number.parseInt(limpio, 10);
  return Number.isNaN(n) ? null : n;
}

function textoONulo(texto: string): string | null {
  const limpio = texto.trim();
  return limpio === "" ? null : limpio;
}

/**
 * Parsea un archivo completo. Si el encabezado no es EXACTAMENTE el esperado,
 * rechaza el archivo entero con un mensaje claro (§2.1).
 */
export function parsearArchivoReservas(contenido: string): FilaReserva[] {
  const filas = parsearCSV(contenido);
  if (filas.length === 0) {
    throw new ErrorImportacion("El archivo está vacío.");
  }

  const encabezado = filas[0];
  const esperado = [...ENCABEZADO_ESPERADO];
  if (
    encabezado.length !== esperado.length ||
    encabezado.some((columna, i) => columna.trim() !== esperado[i])
  ) {
    throw new ErrorImportacion(
      `El encabezado no coincide con el formato de reservas de Airbnb. ` +
        `Se esperaba: ${esperado.join(", ")}. ` +
        `Llegó: ${encabezado.join(", ")}`,
    );
  }

  return filas.slice(1).map((fila, indice) => {
    if (fila.length !== esperado.length) {
      throw new ErrorImportacion(
        `La fila ${indice + 2} tiene ${fila.length} columnas y se esperaban ${esperado.length}.`,
      );
    }
    const raw = Object.fromEntries(esperado.map((columna, i) => [columna, fila[i]]));

    const codigo = raw["Código de confirmación"].trim();
    if (!codigo) {
      throw new ErrorImportacion(`La fila ${indice + 2} no tiene código de confirmación.`);
    }

    return {
      codigo_reserva: codigo,
      estado_raw: raw["Estado"].trim(),
      cancelada: esCancelada(raw["Estado"]),
      huesped_nombre: textoONulo(raw["Nombre del huésped"]),
      huesped_contacto: textoONulo(raw["Contacto"]),
      adultos: enteroONulo(raw["Número de adultos"]),
      ninos: enteroONulo(raw["Número de niños"]),
      bebes: enteroONulo(raw["Número de bebés"]),
      noches: enteroONulo(raw["Número de noches"]),
      fecha_checkin: parsearFechaDMA(raw["Fecha de inicio"]),
      fecha_checkout: parsearFechaDMA(raw["Fecha de finalización"]),
      fecha_reservada: parsearFechaISO(raw["Reservada"]),
      listing_nombre_raw: raw["Anuncio"].trim(),
      payout_monto: parsearGanancias(raw["Ganancias"]),
      payout_moneda: "USD",
      raw,
    };
  });
}

/**
 * Timestamp del nombre del archivo, para ordenar el lote (§2.6).
 * Acepta los dos estilos reales:
 *   `reservations_-_2026-07-18T080825_717.csv`
 *   `reservations - 2026-08-02T084540.299.csv`
 * Nombre que no parsea → null (va al final del lote, con warning).
 */
export function timestampDeNombre(nombre: string): string | null {
  const m = nombre.match(/(\d{4}-\d{2}-\d{2})T(\d{6})(?:[._](\d{1,6}))?/);
  if (!m) return null;
  const [, fecha, hora, fraccion] = m;
  return `${fecha}T${hora}.${(fraccion ?? "0").padEnd(6, "0")}`;
}
