/**
 * Compresión de fotos en el CELULAR, antes de subirlas (spec Fase 2 §2.7:
 * máximo 1200 px, ~200 KB).
 *
 * No es una optimización cosmética: la persona que limpia usa datos móviles
 * y un teléfono de gama baja (spec §3). Una foto sale de la cámara con 3 a 5
 * MB; subir tres así por limpieza es lo que hace que alguien deje de usar la
 * app y vuelva a WhatsApp.
 *
 * Regla de oro: si algo falla —el navegador no sabe decodificar el formato,
 * no hay canvas, el resultado pesa más que el original— se sube el archivo
 * ORIGINAL. Nunca se pierde la foto por intentar achicarla.
 */

/** El lado más largo de la foto, en píxeles. */
export const MAX_LADO = 1200;
/** A partir de acá se deja de bajar la calidad. */
export const OBJETIVO_BYTES = 200 * 1024;
/** Se prueban de mayor a menor y se corta con la primera que entra. */
const CALIDADES = [0.82, 0.7, 0.6, 0.5, 0.4];

/**
 * Cuánto hay que achicar, manteniendo la proporción.
 *
 * Nunca agranda: una foto que ya es chica se deja como está. Agrandarla
 * sumaría peso sin sumar un solo píxel de información.
 */
export function dimensionesDestino(
  ancho: number,
  alto: number,
  maxLado: number = MAX_LADO,
): { ancho: number; alto: number } {
  const lado = Math.max(ancho, alto);
  if (lado <= maxLado || lado === 0) return { ancho, alto };
  const escala = maxLado / lado;
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/** `foto.heic` → `foto.jpg`. El comprimido siempre sale JPEG. */
export function nombreJpg(nombre: string): string {
  const sinExtension = nombre.replace(/\.[^.]+$/, "");
  return `${sinExtension || "foto"}.jpg`;
}

/**
 * ¿Vale la pena quedarse con el comprimido? Solo si de verdad pesa menos.
 * Un PNG chico o una foto ya optimizada puede salir más pesada en JPEG.
 */
export function convieneComprimido(bytesOriginal: number, bytesComprimido: number): boolean {
  return bytesComprimido > 0 && bytesComprimido < bytesOriginal;
}

/**
 * Achica una foto en el navegador. Devuelve el original si no se puede o si
 * no conviene: esta función no falla nunca, solo comprime cuando puede.
 */
export async function comprimirImagen(archivo: File): Promise<File> {
  if (!archivo.type.startsWith("image/")) return archivo;

  try {
    const bitmap = await createImageBitmap(archivo);
    const { ancho, alto } = dimensionesDestino(bitmap.width, bitmap.height);

    const lienzo = document.createElement("canvas");
    lienzo.width = ancho;
    lienzo.height = alto;
    const contexto = lienzo.getContext("2d");
    if (!contexto) {
      bitmap.close();
      return archivo;
    }
    contexto.drawImage(bitmap, 0, 0, ancho, alto);
    bitmap.close();

    let mejor: Blob | null = null;
    for (const calidad of CALIDADES) {
      const blob = await new Promise<Blob | null>((resolver) =>
        lienzo.toBlob(resolver, "image/jpeg", calidad),
      );
      if (!blob) continue;
      mejor = blob;
      if (blob.size <= OBJETIVO_BYTES) break;
    }

    if (!mejor || !convieneComprimido(archivo.size, mejor.size)) return archivo;
    return new File([mejor], nombreJpg(archivo.name), { type: "image/jpeg" });
  } catch {
    // Formato que este navegador no sabe decodificar (HEIC viejo, por
    // ejemplo). Se sube tal cual: el servidor lo acepta igual.
    return archivo;
  }
}
