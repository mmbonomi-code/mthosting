/**
 * Utilidad central de fechas de negocio (CLAUDE.md, regla 1).
 *
 * Las fechas de negocio (check-in, check-out, limpieza) son días calendario
 * en la zona horaria de Buenos Aires, representados como texto `yyyy-mm-dd`.
 * "Hoy" y "mañana" se calculan SIEMPRE acá, nunca con `new Date()` pelado.
 */

export const ZONA_HORARIA = "America/Argentina/Buenos_Aires";

const formatoISO = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha de hoy en Buenos Aires, como `yyyy-mm-dd`. */
export function hoyAR(): string {
  return formatoISO.format(new Date());
}

/** Fecha de mañana en Buenos Aires, como `yyyy-mm-dd`. */
export function mananaAR(): string {
  return sumarDias(hoyAR(), 1);
}

/** Suma (o resta) días a una fecha `yyyy-mm-dd`, sin zonas horarias de por medio. */
export function sumarDias(fechaISO: string, dias: number): string {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

/** `yyyy-mm-dd` → `dd/mm/aaaa`, el formato de presentación es-AR. */
export function formatearFechaAR(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}
