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

/**
 * El día de Buenos Aires en el que cayó un instante. Sirve para preguntarle
 * a un `timestamptz` "¿de qué día es?" sin equivocarse por las tres horas de
 * diferencia con UTC.
 */
export function diaARDe(instante: string | null): string | null {
  if (!instante) return null;
  const momento = new Date(instante);
  return Number.isNaN(momento.getTime()) ? null : formatoISO.format(momento);
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

/** Cuántos días hay entre dos fechas `yyyy-mm-dd`. Siempre positivo. */
export function distanciaEnDias(unaISO: string, otraISO: string): number {
  const aDias = (iso: string) => {
    const [anio, mes, dia] = iso.split("-").map(Number);
    return Date.UTC(anio, mes - 1, dia) / 86_400_000;
  };
  return Math.abs(aDias(unaISO) - aDias(otraISO));
}

/** `yyyy-mm-dd` → `dd/mm/aaaa`, el formato de presentación es-AR. */
export function formatearFechaAR(fechaISO: string): string {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

// --- Meses -------------------------------------------------------------------
// El mes se maneja como texto `aaaa-mm`, igual que las fechas: sin objetos
// Date dando vueltas y sin sorpresas de zona horaria.

/** El mes al que pertenece una fecha: `2026-08-15` → `2026-08`. */
export function mesDe(fechaISO: string): string {
  return fechaISO.slice(0, 7);
}

/** El mes de hoy en Buenos Aires. */
export function mesActualAR(): string {
  return mesDe(hoyAR());
}

/** Primer día del mes: `2026-08` → `2026-08-01`. */
export function primerDiaDelMes(mes: string): string {
  return `${mes}-01`;
}

/** Corre el mes: `sumarMeses("2026-12", 1)` → `2027-01`. */
export function sumarMeses(mes: string, cantidad: number): string {
  const [anio, m] = mes.split("-").map(Number);
  const total = anio * 12 + (m - 1) + cantidad;
  const nuevoAnio = Math.floor(total / 12);
  const nuevoMes = total % 12;
  return `${nuevoAnio}-${String(nuevoMes + 1).padStart(2, "0")}`;
}

const NOMBRES_MES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** `2026-08` → `agosto 2026`. */
export function nombreDelMes(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  return `${NOMBRES_MES[m - 1]} ${anio}`;
}
