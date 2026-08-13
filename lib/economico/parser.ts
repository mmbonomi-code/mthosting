/**
 * Parser del CSV de transacciones de Airbnb (Ganancias → Historial de
 * transacciones), spec §2 y §5.
 *
 * Funciones puras, sin base de datos: todo lo de acá tiene test. Las reglas
 * están validadas contra los tres exports reales de `datos-privados/`, no
 * solo contra la spec.
 *
 * Lo que este archivo NO hace: calcular ganancia ni percibido. Eso es el motor
 * de cálculo (etapa 2). Acá se lee el archivo y se lo deja fiel.
 */

import { createHash } from "node:crypto";
import { parsearCSV } from "../importador/parser";

/** Rechaza el archivo entero. Nunca "importar lo que se pueda". */
export class ErrorArchivoEconomico extends Error {}

export type Categoria =
  | "reserva"
  | "coanfitrion"
  | "payout"
  | "resolucion"
  | "ajuste"
  | "ajuste_resolucion"
  | "tarifa_cancelacion"
  | "reembolso_tarifa_cancelacion"
  | "aircover"
  | "otro";

export type FilaTransaccion = {
  /** Renglón del archivo contando el encabezado: es el que se abre en Excel. */
  linea: number;
  /** Posición entre las filas de datos. El orden agrupa payout → detalle. */
  orden_en_archivo: number;
  categoria: Categoria;
  tipo_raw: string;
  fecha: string;
  fecha_reserva: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  noches: number | null;
  anuncio: string | null;
  codigo_confirmacion: string | null;
  huesped: string | null;
  detalles: string | null;
  moneda: string;
  monto: number | null;
  cobrado: number | null;
  /** `cobrado` en los payouts, `monto` en el resto. */
  importe: number | null;
  tarifa_limpieza: number | null;
  ingresos_brutos: number | null;
  es_payout: boolean;
  /** Número de grupo dentro del archivo. Null antes del primer Payout. */
  grupo_payout: number | null;
  grupo_con_coanfitrion: boolean;
  /** Cuenta destino, solo en los payouts. */
  cuenta: CuentaDetectada | null;
  ocurrencia: number;
  huella: string;
  raw: Record<string, string>;
};

export type ResultadoArchivo = {
  filas: FilaTransaccion[];
  /** Sugerencia, no verdad: el usuario elige el tipo de carga. */
  pareceProgramado: boolean;
  avisos: string[];
};

// ----------------------------------------------------------------------------
// Texto
// ----------------------------------------------------------------------------

/**
 * Repara el destrozo de codificación heredado: archivos guardados como UTF-8 y
 * releídos como Latin-1 dejan "CÃ³modo" donde decía "Cómodo".
 *
 * Se arregla acá y no normalizando acentos, porque `Ã³` y `ó` son caracteres
 * distintos: sacarle los tildes a "CÃ³modo" da "cã³modo", que no se parece a
 * "comodo" ni de casualidad.
 */
export function repararMojibake(texto: string): string {
  if (!/[ÃÂ]/.test(texto)) return texto;

  const bytes: number[] = [];
  for (const caracter of texto) {
    const codigo = caracter.codePointAt(0)!;
    if (codigo <= 0xff) {
      bytes.push(codigo);
      continue;
    }
    // "Ãšnico" tiene una 'š' (U+0161): la mala lectura fue con Windows-1252,
    // no con Latin-1, y en esa tabla los códigos 0x80–0x9F son otros signos.
    // Sin volver a convertirlos a su byte, la mitad de los casos no se arregla.
    const byte = CP1252.get(codigo);
    if (byte === undefined) return texto;
    bytes.push(byte);
  }

  try {
    const reparado = new TextDecoder("utf-8", { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
    // Si el resultado sigue teniendo el patrón, no era mojibake: se deja igual.
    return /[ÃÂ]/.test(reparado) ? texto : reparado;
  } catch {
    // No era UTF-8 mal leído. El texto original es el bueno.
    return texto;
  }
}

/** Los códigos 0x80–0x9F de Windows-1252, para deshacer la mala lectura. */
const CP1252 = new Map<number, number>([
  [0x20ac, 0x80], [0x201a, 0x82], [0x0192, 0x83], [0x201e, 0x84],
  [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02c6, 0x88],
  [0x2030, 0x89], [0x0160, 0x8a], [0x2039, 0x8b], [0x0152, 0x8c],
  [0x017d, 0x8e], [0x2018, 0x91], [0x2019, 0x92], [0x201c, 0x93],
  [0x201d, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97],
  [0x02dc, 0x98], [0x2122, 0x99], [0x0161, 0x9a], [0x203a, 0x9b],
  [0x0153, 0x9c], [0x017e, 0x9e], [0x0178, 0x9f],
]);

/** Para comparar anuncios: sin acentos, sin mayúsculas, sin espacios de más. */
export function normalizarTexto(texto: string): string {
  return repararMojibake(texto)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// ----------------------------------------------------------------------------
// Fechas y números
// ----------------------------------------------------------------------------

/**
 * Airbnb exporta en formato de Estados Unidos: MM/DD/YYYY. También aparece
 * YYYY-MM-DD. Devuelve siempre YYYY-MM-DD, que es como se guardan las fechas
 * de negocio.
 */
export function parsearFechaAirbnb(valor: string | null | undefined): string | null {
  const texto = (valor ?? "").trim();
  if (texto === "") return null;

  const iso = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return texto;

  const us = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (us) {
    const [, mes, dia, anio] = us;
    return `${anio}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }
  return null;
}

/**
 * Los montos vienen con punto decimal (`126.39`) y con coma (`3,91`) en el
 * MISMO archivo, según la columna. Miles con coma también existe (`1,234.56`).
 *
 * La regla: el último separador que aparece es el decimal, salvo que lo que
 * le sigue tenga tres dígitos y no haya otro separador, que es el caso
 * ambiguo `1,234`. Ahí gana miles, porque un importe de Airbnb con tres
 * decimales no existe.
 */
export function parsearNumero(valor: string | null | undefined): number | null {
  const texto = (valor ?? "").trim().replace(/\s/g, "");
  if (texto === "") return null;

  const negativo = texto.startsWith("-");
  const cuerpo = texto.replace(/^[+-]/, "");
  if (!/^[\d.,]+$/.test(cuerpo)) return null;

  const ultimaComa = cuerpo.lastIndexOf(",");
  const ultimoPunto = cuerpo.lastIndexOf(".");
  let limpio: string;

  if (ultimaComa === -1 && ultimoPunto === -1) {
    limpio = cuerpo;
  } else {
    const corte = Math.max(ultimaComa, ultimoPunto);
    const decimales = cuerpo.length - corte - 1;
    const hayOtro = cuerpo.slice(0, corte).match(/[.,]/) !== null;
    if (decimales === 3 && !hayOtro) {
      limpio = cuerpo.replace(/[.,]/g, ""); // 1,234 son mil doscientos treinta y cuatro
    } else {
      limpio = cuerpo.slice(0, corte).replace(/[.,]/g, "") + "." + cuerpo.slice(corte + 1);
    }
  }

  const numero = Number.parseFloat(limpio);
  if (Number.isNaN(numero)) return null;
  return negativo ? -numero : numero;
}

// ----------------------------------------------------------------------------
// Categoría
// ----------------------------------------------------------------------------

const POR_TIPO: Record<string, Categoria> = {
  "reserva": "reserva",
  "cobro como coanfitrion": "coanfitrion",
  "payout": "payout",
  "cobro de la resolucion": "resolucion",
  "ajuste": "ajuste",
  "ajuste de la resolucion": "ajuste_resolucion",
  "tarifa de cancelacion": "tarifa_cancelacion",
  "reembolso de la tarifa de cancelacion": "reembolso_tarifa_cancelacion",
};

/**
 * Un `Cobro de la resolución` cuyo detalle dice "Reembolso de AirCover" no es
 * ingreso del alquiler: es una indemnización por daños. Puede corresponderle
 * al propietario o a MTHosting y eso NO se puede decidir desde el CSV, así que
 * va a su propia categoría y espera una decisión humana.
 */
export function categorizar(tipo: string, detalles: string | null): Categoria {
  const clave = normalizarTexto(tipo);
  const base = POR_TIPO[clave] ?? "otro";
  if (base === "resolucion" && /reembolso de aircover/i.test(detalles ?? "")) {
    return "aircover";
  }
  return base;
}

// ----------------------------------------------------------------------------
// Cuentas de payout
// ----------------------------------------------------------------------------

export type CuentaDetectada = {
  /** Identidad de la cuenta REAL: el número cuando existe, si no el texto. */
  clave: string;
  titular: string | null;
  numero: string | null;
  tipo: string | null;
  moneda: string | null;
  detalle_raw: string;
};

const TIPOS_CUENTA: [RegExp, string][] = [
  [/payoneer/i, "payoneer"],
  [/paypal/i, "paypal"],
  [/checking/i, "checking"],
  [/savings/i, "savings"],
  [/iban/i, "iban"],
];

/**
 * Saca titular, tipo, número y moneda del texto libre de `Detalles`.
 *
 * Formas reales:
 *   "Transferir a MTHOSTING, Checking 4343 (USD)"
 *   "Transferir a Emmanuel De Saizieu, 0665 (ARS)"
 *   "Transferir a Tarjeta de débito: Payoneer (USD)"
 *   "Transferir a PayPal b••••n@gmail.com"
 *
 * La clave agrupa por NÚMERO cuando lo hay: la 4343 aparece con siete
 * grafías distintas del mismo titular y es una sola cuenta.
 */
export function parsearCuenta(detalles: string | null): CuentaDetectada | null {
  const texto = repararMojibake((detalles ?? "").trim());
  if (texto === "") return null;

  const moneda = texto.match(/\(([A-Z]{3})\)\s*$/)?.[1] ?? null;
  const sinMoneda = texto.replace(/\s*\([A-Z]{3}\)\s*$/, "").trim();
  const cuerpo = sinMoneda.replace(/^transferir a\s*/i, "").trim();

  const tipo = TIPOS_CUENTA.find(([re]) => re.test(cuerpo))?.[1] ?? null;

  // El número va al final y es el último grupo de dígitos suelto.
  const numero = cuerpo.match(/(?:^|[\s,])(\d{3,})\s*$/)?.[1] ?? null;

  let titular: string | null = cuerpo.replace(/[\s,]*\d{3,}\s*$/, "").trim();
  titular = titular.replace(/,?\s*(Checking|Savings|IBAN)\s*$/i, "").trim();
  if (titular === "") titular = null;

  return {
    clave: numero !== null ? `num:${numero}` : `txt:${normalizarTexto(texto)}`,
    titular,
    numero,
    tipo,
    moneda,
    detalle_raw: texto,
  };
}

// ----------------------------------------------------------------------------
// Lectura del archivo
// ----------------------------------------------------------------------------

/** Columnas sin las que el archivo no sirve para nada. */
const OBLIGATORIAS = ["Fecha", "Tipo", "Moneda"] as const;

/** Busca una columna por nombre, tolerando acentos rotos y mayúsculas. */
function indiceDe(encabezado: string[], nombre: string): number {
  const buscado = normalizarTexto(nombre);
  return encabezado.findIndex((c) => normalizarTexto(c) === buscado);
}

/**
 * Lee un CSV de transacciones.
 *
 * Hay tres variantes de encabezado en circulación (21, 22 y 18 columnas). Por
 * eso las columnas se buscan SIEMPRE por nombre y nunca por posición: la de 18
 * no trae `Cobrado` ni `Fecha de llegada estimada` y las demás corren de lugar.
 */
export function parsearTransacciones(contenido: string): ResultadoArchivo {
  const crudas = parsearCSV(contenido);
  if (crudas.length === 0) {
    throw new ErrorArchivoEconomico("El archivo está vacío.");
  }

  const encabezado = crudas[0].map((c) => c.trim());
  const faltantes = OBLIGATORIAS.filter((c) => indiceDe(encabezado, c) === -1);
  if (faltantes.length > 0) {
    throw new ErrorArchivoEconomico(
      `No parece un historial de transacciones de Airbnb: le faltan las columnas ${faltantes.join(", ")}.`,
    );
  }

  const col = {
    fecha: indiceDe(encabezado, "Fecha"),
    tipo: indiceDe(encabezado, "Tipo"),
    codigo: indiceDe(encabezado, "Código de confirmación"),
    fechaReserva: indiceDe(encabezado, "Fecha de la reserva"),
    inicio: indiceDe(encabezado, "Fecha de inicio"),
    fin: indiceDe(encabezado, "Fecha de finalización"),
    noches: indiceDe(encabezado, "Noches"),
    huesped: indiceDe(encabezado, "Huésped"),
    anuncio: indiceDe(encabezado, "Anuncio"),
    detalles: indiceDe(encabezado, "Detalles"),
    moneda: indiceDe(encabezado, "Moneda"),
    monto: indiceDe(encabezado, "Monto"),
    cobrado: indiceDe(encabezado, "Cobrado"),
    limpieza: indiceDe(encabezado, "Tarifa de limpieza"),
    brutos: indiceDe(encabezado, "Ingresos brutos"),
  };

  const avisos: string[] = [];
  const valor = (fila: string[], i: number): string | null => {
    if (i === -1) return null;
    const v = (fila[i] ?? "").trim();
    return v === "" ? null : repararMojibake(v);
  };

  const filas: FilaTransaccion[] = [];
  // Cuenta las filas idénticas DENTRO de este archivo: la primera es la
  // ocurrencia 1, la segunda la 2. Al reimportar el mismo archivo vuelven a
  // matchear una a una en vez de colapsar.
  const vistas = new Map<string, number>();

  let grupo = 0;
  let orden = 0;

  for (let i = 1; i < crudas.length; i++) {
    const cruda = crudas[i];
    // Fila vacía del final del archivo.
    if (cruda.length <= 1 && (cruda[0] ?? "").trim() === "") continue;

    const tipoRaw = valor(cruda, col.tipo);
    const fecha = parsearFechaAirbnb(valor(cruda, col.fecha) ?? "");
    if (tipoRaw === null || fecha === null) {
      avisos.push(
        `Renglón ${i + 1}: sin tipo o sin fecha reconocible, no se puede imputar. Queda afuera.`,
      );
      continue;
    }

    const detalles = valor(cruda, col.detalles);
    const categoria = categorizar(tipoRaw, detalles);
    if (categoria === "otro") {
      avisos.push(`Renglón ${i + 1}: tipo "${tipoRaw}" desconocido. Se guarda sin comisionar.`);
    }

    const esPayout = categoria === "payout";
    if (esPayout) grupo++;

    const monto = parsearNumero(valor(cruda, col.monto));
    const cobrado = parsearNumero(valor(cruda, col.cobrado));

    const raw: Record<string, string> = {};
    encabezado.forEach((c, j) => {
      const v = (cruda[j] ?? "").trim();
      if (v !== "") raw[c] = v;
    });

    // La clave natural, validada sobre los datos reales. `Cobrado` es
    // imprescindible: en los Payout el Monto viene vacío y sin Cobrado dos
    // payouts distintos del mismo día a la misma cuenta colapsan en uno.
    const clave = [
      tipoRaw,
      valor(cruda, col.codigo) ?? "",
      fecha,
      valor(cruda, col.monto) ?? "",
      valor(cruda, col.cobrado) ?? "",
      valor(cruda, col.moneda) ?? "",
      valor(cruda, col.anuncio) ?? "",
      detalles ?? "",
    ].join("");

    const ocurrencia = (vistas.get(clave) ?? 0) + 1;
    vistas.set(clave, ocurrencia);

    filas.push({
      linea: i + 1,
      orden_en_archivo: orden++,
      categoria,
      tipo_raw: tipoRaw,
      fecha,
      fecha_reserva: parsearFechaAirbnb(valor(cruda, col.fechaReserva)),
      fecha_inicio: parsearFechaAirbnb(valor(cruda, col.inicio)),
      fecha_fin: parsearFechaAirbnb(valor(cruda, col.fin)),
      noches: parsearNumero(valor(cruda, col.noches)),
      anuncio: valor(cruda, col.anuncio),
      codigo_confirmacion: valor(cruda, col.codigo),
      huesped: valor(cruda, col.huesped),
      detalles,
      moneda: valor(cruda, col.moneda) ?? "USD",
      monto,
      cobrado,
      importe: esPayout ? cobrado : monto,
      tarifa_limpieza: parsearNumero(valor(cruda, col.limpieza)),
      ingresos_brutos: parsearNumero(valor(cruda, col.brutos)),
      es_payout: esPayout,
      grupo_payout: grupo === 0 ? null : grupo,
      grupo_con_coanfitrion: false, // se resuelve al agrupar, más abajo
      cuenta: esPayout ? parsearCuenta(detalles) : null,
      ocurrencia,
      huella: createHash("sha256").update(`${clave}${ocurrencia}`).digest("hex"),
      raw,
    });
  }

  marcarGrupos(filas, avisos);

  return {
    filas,
    // La variante de 18 columnas no trae `Cobrado`: son los programados.
    pareceProgramado: col.cobrado === -1,
    avisos,
  };
}

/**
 * Marca, en todas las filas de cada grupo, si el grupo tiene línea de
 * coanfitrión.
 *
 * Es lo que después distingue un payout que es ingreso propio de uno que es
 * plata del propietario en tránsito: si la comisión ya se cobró por el canal
 * de coanfitrión, el payout es custodia. Se guarda como hecho del archivo,
 * separado de la clasificación de la cuenta, que puede cambiar después.
 */
function marcarGrupos(filas: FilaTransaccion[], avisos: string[]): void {
  const conCoanfitrion = new Set<number>();
  const conDetalle = new Set<number>();

  for (const f of filas) {
    if (f.grupo_payout === null) continue;
    if (f.categoria === "coanfitrion") conCoanfitrion.add(f.grupo_payout);
    if (!f.es_payout) conDetalle.add(f.grupo_payout);
  }

  for (const f of filas) {
    if (f.grupo_payout !== null && conCoanfitrion.has(f.grupo_payout)) {
      f.grupo_con_coanfitrion = true;
    }
  }

  // Filas de detalle antes del primer Payout: el corte del export las dejó
  // separadas de su payout. No se descartan; se avisan.
  const huerfanas = filas.filter((f) => f.grupo_payout === null).length;
  if (huerfanas > 0) {
    avisos.push(
      `${huerfanas} fila${huerfanas === 1 ? "" : "s"} aparece${huerfanas === 1 ? "" : "n"} antes del primer Payout del archivo: se guardan, pero su payout quedó en otro export.`,
    );
  }

  // Payout sin ninguna fila de detalle debajo: no se puede saber a qué
  // departamento imputarlo.
  const sinDetalle = filas.filter((f) => f.es_payout && !conDetalle.has(f.grupo_payout!));
  if (sinDetalle.length > 0) {
    avisos.push(
      `${sinDetalle.length} payout${sinDetalle.length === 1 ? "" : "s"} sin filas de detalle: quedan sin imputar a ningún departamento.`,
    );
  }
}
