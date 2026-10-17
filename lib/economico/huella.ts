/**
 * La clave natural de una fila de Airbnb, su huella, y el arreglo de textos
 * que hace falta para calcularlas.
 *
 * Vive aparte del parser porque la usan dos cosas: el importador, cuando lee
 * un archivo, y el recalculo de huellas de `scripts/recalcular-huellas.ts`.
 * No importa nada del proyecto, asi que se puede correr suelta.
 */

import { createHash } from "node:crypto";

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
// La clave natural de una fila
// ----------------------------------------------------------------------------

/**
 * Separador invisible entre los pedazos de la clave: ningún texto de Airbnb
 * lo contiene, así que dos campos nunca se confunden con uno solo.
 */
export const SEPARADOR = "\u0001";

/**
 * Qué parte del anuncio entra en la clave natural de una fila.
 *
 * Cuando la fila trae código de confirmación, NADA: la reserva ya la
 * identifica, y meter el título de la publicación hacía que renombrarla en
 * Airbnb volviera a importar toda la historia como filas nuevas. Pasó el
 * 17/10/2026: a tres departamentos de Talcahuano les agregaron un punto
 * ("Premium depto. en Recoleta 09") y entraron 547 filas repetidas.
 *
 * En las filas sin código —los payout— el anuncio sí hace falta: sin él, dos
 * cobros iguales el mismo día desde publicaciones distintas colapsarían en
 * uno solo. Va normalizado, así una tilde o una mayúscula no alcanzan para
 * duplicar una fila.
 */
export function claveDeAnuncio(codigo: string | null, anuncio: string | null): string {
  if (codigo !== null && codigo.trim() !== "") return "";
  return anuncio === null ? "" : normalizarTexto(anuncio);
}

/** La huella de una fila: su clave natural y cuál ocurrencia es dentro del archivo. */
export function huellaDe(clave: string, ocurrencia: number): string {
  return createHash("sha256").update(`${clave}${SEPARADOR}${ocurrencia}`).digest("hex");
}
