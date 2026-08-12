/**
 * Parser del export de caja de Ninox (GASTOS.csv).
 *
 * Se corre una sola vez para traer la historia, pero igual va con tests: es
 * un archivo con 545 movimientos que tienen que cerrar en un saldo exacto, y
 * un error de parseo acá se convierte en plata mal contada.
 *
 * Particularidades reales del archivo, validadas contra el export del
 * 11/08/2026:
 *   - Separador `;`, campos entrecomillados que contienen saltos de línea.
 *   - Fechas en castellano abreviado: `4 feb. 2026`.
 *   - Montos con punto de miles y coma decimal.
 *   - La columna VALOR USD trae `Infinity` en 240 filas: es una división por
 *     una cotización vacía, no un dato. Se descarta.
 *   - La columna SALDO ACUMULADO se ignora: el saldo se recalcula.
 */

export class ErrorCaja extends Error {}

/** CSV con comillas y saltos de línea adentro de los campos. */
export function parsearCSV(texto: string, separador = ";"): string[][] {
  const filas: string[][] = [];
  let campo = "";
  let fila: string[] = [];
  let enComillas = false;
  const t = texto.replace(/^﻿/, "").replace(/\r\n/g, "\n");

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (enComillas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === separador) {
      fila.push(campo);
      campo = "";
    } else if (c === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

const MESES: Record<string, number> = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

/** `4 feb. 2026` → `2026-02-04`. Vacío → null. */
export function parsearFechaNinox(texto: string): string | null {
  const limpio = texto.trim();
  if (limpio === "") return null;

  const m = limpio.match(/^(\d{1,2})\s+([a-záéíóú]{3})\.?\s+(\d{4})$/i);
  if (!m) throw new ErrorCaja(`Fecha con formato desconocido: "${texto}"`);

  const mes = MESES[m[2].toLowerCase()];
  if (!mes) throw new ErrorCaja(`Mes desconocido: "${texto}"`);

  const dia = Number(m[1]);
  const anio = Number(m[3]);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (fecha.getUTCDate() !== dia || fecha.getUTCMonth() !== mes - 1) {
    throw new ErrorCaja(`Fecha inexistente: "${texto}"`);
  }

  return `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

/** `1.716.000` → 1716000 · `1187,543253` → 1187.543253 · vacío → null. */
export function parsearMontoNinox(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === "" || limpio === "Infinity" || limpio === "-Infinity") return null;

  const normalizado = limpio.includes(",")
    ? limpio.replace(/\./g, "").replace(",", ".")
    : limpio.replace(/\./g, "");

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) {
    throw new ErrorCaja(`Monto con formato desconocido: "${texto}"`);
  }
  const valor = Number(normalizado);
  return Number.isFinite(valor) ? valor : null;
}

/** `Sí` → true · `No` o vacío → false. */
export function parsearSiNo(texto: string): boolean {
  return /^s[ií]$/i.test(texto.trim());
}

export type FilaCaja = {
  fecha: string;
  tipo: "ingreso" | "egreso";
  categoria: string;
  descripcion: string | null;
  monto: number;
  /** Nombre del departamento tal como está escrito en el archivo. */
  depto: string | null;
  reembolsable: boolean;
  cobrado: boolean;
  forma_cobro: string | null;
  fecha_cobro: string | null;
  observacion: string | null;
  /** Cotización deducida de MONTO / VALOR USD, si el archivo la permite. */
  tc: number | null;
};

const ENCABEZADO = [
  "FECHA", "MOVIMIENTO", "TIPO DE GASTO", "DETALLE", "MONTO",
  "SALDO ACUMULADO INGRESOS", "REEMBOLSO?", "OBSERVACION", "NOMBRE",
  "VALOR USD", "REEMBOLSO PAGADO?", "FORMA DE PAGO", "FECHA PAGO",
];

function limpio(valor: string | undefined): string | null {
  const t = (valor ?? "").trim();
  return t === "" ? null : t;
}

/**
 * Parsea el archivo entero. Rechaza el archivo completo si el encabezado no
 * es el esperado: nunca "importar lo que se pueda".
 */
export function parsearCajaNinox(contenido: string): FilaCaja[] {
  const crudo = parsearCSV(contenido);
  if (crudo.length === 0) throw new ErrorCaja("El archivo está vacío.");

  const cabecera = crudo[0].map((c) => c.trim());
  if (cabecera.length < ENCABEZADO.length) {
    throw new ErrorCaja(
      `El encabezado tiene ${cabecera.length} columnas y se esperaban ${ENCABEZADO.length}.`,
    );
  }
  for (const [i, esperada] of ENCABEZADO.entries()) {
    if (cabecera[i] !== esperada) {
      throw new ErrorCaja(
        `Columna ${i + 1}: se esperaba "${esperada}" y vino "${cabecera[i]}".`,
      );
    }
  }

  const filas: FilaCaja[] = [];

  for (const [indice, cruda] of crudo.slice(1).entries()) {
    const campo = (n: number) => cruda[n] ?? "";
    const fecha = parsearFechaNinox(campo(0));
    // Las filas separadoras del export vienen todas vacías.
    if (fecha === null) continue;

    const movimiento = campo(1).trim().toUpperCase();
    if (movimiento !== "INGRESO" && movimiento !== "EGRESO") {
      throw new ErrorCaja(
        `Fila ${indice + 2}: MOVIMIENTO tiene "${campo(1)}" y se esperaba INGRESO o EGRESO.`,
      );
    }

    const monto = parsearMontoNinox(campo(4));
    if (monto === null || monto <= 0) {
      throw new ErrorCaja(`Fila ${indice + 2}: monto vacío o no positivo ("${campo(4)}").`);
    }

    const usd = parsearMontoNinox(campo(9));
    // La cotización sale de dividir; el archivo no la trae de forma directa.
    const tc = usd !== null && usd > 0 ? Math.round((monto / usd) * 100) / 100 : null;

    const categoria = limpio(campo(2));
    if (!categoria) {
      throw new ErrorCaja(`Fila ${indice + 2}: sin tipo de gasto.`);
    }

    filas.push({
      fecha,
      tipo: movimiento === "INGRESO" ? "ingreso" : "egreso",
      // El archivo tiene "GASTOS  SERVICIOS" con dos espacios.
      categoria: categoria.replace(/\s+/g, " "),
      descripcion: limpio(campo(3)),
      monto,
      depto: limpio(campo(8)),
      reembolsable: parsearSiNo(campo(6)),
      cobrado: parsearSiNo(campo(10)),
      forma_cobro: limpio(campo(11)),
      fecha_cobro: parsearFechaNinox(campo(12)),
      observacion: limpio(campo(7)),
      tc,
    });
  }

  return filas;
}

/**
 * Las cotizaciones que se pueden deducir del archivo, una por fecha.
 *
 * Si una misma fecha tuviera dos cotizaciones distintas se informa en vez de
 * elegir una en silencio. En el archivo real no pasa en ninguna de las 59.
 */
export function cotizacionesDelArchivo(filas: FilaCaja[]): {
  cotizaciones: { fecha: string; tc: number }[];
  conflictos: string[];
} {
  const porFecha = new Map<string, Set<number>>();
  for (const f of filas) {
    if (f.tc === null) continue;
    const set = porFecha.get(f.fecha) ?? new Set<number>();
    set.add(f.tc);
    porFecha.set(f.fecha, set);
  }

  const cotizaciones: { fecha: string; tc: number }[] = [];
  const conflictos: string[] = [];

  for (const [fecha, valores] of [...porFecha].sort()) {
    if (valores.size > 1) {
      conflictos.push(`${fecha}: ${[...valores].join(", ")}`);
    }
    cotizaciones.push({ fecha, tc: [...valores][0] });
  }

  return { cotizaciones, conflictos };
}

/** El saldo que tiene que dar el archivo, para verificar la importación. */
export function saldoDelArchivo(filas: FilaCaja[]): number {
  return filas.reduce((s, f) => s + (f.tipo === "ingreso" ? f.monto : -f.monto), 0);
}
