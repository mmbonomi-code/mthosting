/**
 * Teléfonos argentinos: el 9 después del +54.
 *
 * Airbnb entrega los contactos argentinos sin el 9 (`+54 11 4428-2700`). Sin
 * ese dígito el número no sirve para WhatsApp ni para llamar desde afuera del
 * país, así que se agrega al importar, al exportar y en los datos ya cargados
 * (decisión del dueño, 07/08/2026).
 *
 * Cómo se reconoce el caso, sin ambigüedad:
 *   - empieza con 54 y NO con 549 (ningún código de área argentino empieza
 *     con 9, así que un 549 solo puede ser el 9 del móvil ya puesto), y
 *   - tiene 12 dígitos: 54 + los 10 nacionales (área + abonado). Un número
 *     argentino siempre tiene 10 dígitos nacionales.
 * Cualquier otra cosa se deja como está: es preferible un número intacto a
 * uno "arreglado" mal.
 */

/** Solo los dígitos: `+54 11 4428-2700` → `541144282700`. */
export function soloDigitos(contacto: string | null): string | null {
  if (!contacto) return null;
  const digitos = contacto.replace(/\D/g, "");
  return digitos === "" ? null : digitos;
}

/** ¿Es un argentino al que le falta el 9? */
export function faltaNueveAR(digitos: string): boolean {
  return digitos.length === 12 && digitos.startsWith("54") && !digitos.startsWith("549");
}

/** `541144282700` → `5491144282700`. Si no corresponde, lo devuelve igual. */
export function agregarNueveAR(digitos: string): string {
  return faltaNueveAR(digitos) ? `549${digitos.slice(2)}` : digitos;
}

/**
 * Lo mismo pero sobre el texto tal como se guarda, para no perder el formato
 * legible: `+54 11 4428-2700` → `+54 9 11 4428-2700`.
 */
export function corregirContactoAR(contacto: string | null): string | null {
  if (!contacto) return contacto;
  const digitos = soloDigitos(contacto);
  if (!digitos || !faltaNueveAR(digitos)) return contacto;
  // El 9 va justo después del código de país, sea cual sea la puntuación con
  // la que venga escrito (`+54`, `54`, `+ 54`).
  return contacto.replace(/^(\D*5\D*4)/, "$1 9");
}
