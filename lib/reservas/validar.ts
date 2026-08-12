/**
 * Alta y edición manual de reservas (docs/FASE-1-ESPECIFICACION.md §2.10.bis).
 *
 * Reglas del negocio, no de la pantalla: qué es una reserva válida, cuántas
 * noches tiene y qué código lleva cuando no viene de Airbnb.
 *
 * Funciones puras, con tests.
 */

export type OrigenManual = "airbnb" | "directa";

export type DatosReserva = {
  origen: OrigenManual;
  codigo_reserva: string;
  depto_id: string | null;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  huesped_nombre: string | null;
  adultos: number | null;
};

/**
 * Noches entre dos fechas. Del 10 al 12 son 2: el día de salida no se
 * duerme. `null` si falta alguna o si están al revés.
 */
export function calcularNoches(
  checkin: string | null,
  checkout: string | null,
): number | null {
  if (!checkin || !checkout) return null;
  const dias =
    (Date.parse(`${checkout}T00:00:00Z`) - Date.parse(`${checkin}T00:00:00Z`)) /
    86_400_000;
  return dias > 0 ? dias : null;
}

/**
 * Qué falta o qué está mal, en el orden en que conviene leerlo. Lista vacía
 * es "se puede guardar".
 */
export function validarReserva(datos: DatosReserva): string[] {
  const errores: string[] = [];

  if (!datos.depto_id) errores.push("Elegí el departamento.");
  if (!datos.fecha_checkin) errores.push("Falta la fecha de entrada.");
  if (!datos.fecha_checkout) errores.push("Falta la fecha de salida.");

  if (datos.fecha_checkin && datos.fecha_checkout) {
    if (datos.fecha_checkout <= datos.fecha_checkin) {
      errores.push("La salida tiene que ser posterior a la entrada.");
    }
  }

  // El código de Airbnb es la clave con la que después se fusiona la
  // importación: sin él, la reserva cargada a mano quedaría duplicada.
  if (datos.origen === "airbnb" && datos.codigo_reserva.trim() === "") {
    errores.push("Poné el código de Airbnb, o cargala como reserva directa.");
  }

  if (datos.adultos !== null && datos.adultos < 0) {
    errores.push("La cantidad de personas no puede ser negativa.");
  }

  return errores;
}

/**
 * El código de una reserva que no viene de Airbnb. Lleva prefijo para que se
 * distinga de un golpe de vista de los códigos reales, que empiezan con HM.
 * El sufijo aleatorio lo pasa quien llama, para que esto siga siendo puro.
 */
export function codigoDeReservaDirecta(aleatorio: string): string {
  return `DIR-${aleatorio.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase()}`;
}

/** ¿Es un código que generamos nosotros y no uno de Airbnb? */
export function esCodigoDirecto(codigo: string): boolean {
  return codigo.startsWith("DIR-");
}

/**
 * Sobre una reserva que vino de Airbnb —del CSV o del calendario— lo que se
 * edita a mano es un arreglo temporal: la próxima importación lo pisa. Hay
 * que decirlo antes de editar, no después (§2.10.bis).
 */
export function airbnbPisaLoEditado(origen: string, codigo: string): boolean {
  if (origen === "csv" || origen === "ical") return true;
  // Una manual cargada con el código real de Airbnb también se va a fusionar.
  return origen === "manual" && !esCodigoDirecto(codigo);
}
