/**
 * Excel de reservas tentativas (decisión del dueño, 13/09/2026).
 *
 * Desde que Airbnb sacó la exportación del archivo de reservas, las que
 * descubre el calendario se quedan sin nombre, teléfono, huéspedes ni monto.
 * Este archivo las lista TODAS —futuras y pasadas— con el link directo a
 * cada una en Airbnb, para completar esos datos por fuera.
 *
 * Las columnas a completar ya vienen con lo que el sistema tenga: si una
 * tentativa ya tiene el nombre cargado, no se lo muestra vacío. Así el mismo
 * archivo puede volver a subirse más adelante sin pisar nada con un vacío
 * (CLAUDE.md, regla 4).
 *
 * Se excluyen las canceladas y las descartadas: no hay nada que completarles.
 *
 * Funciones puras, con tests.
 */

import type { EstadoCambio, TipoCambio } from "../ical/cambios";
import { cambioPendiente } from "../ical/cambios";
import { ETIQUETA_CAMBIO_CALENDARIO } from "../estados";
import { fechaCorta } from "./contactos";

export type ReservaTentativa = {
  codigo_reserva: string;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  noches: number | null;
  huesped_nombre: string | null;
  huesped_contacto: string | null;
  adultos: number | null;
  ninos: number | null;
  bebes: number | null;
  payout_monto: number | null;
  raw: unknown;
  depto: { codigo: string } | null;
  cambios: { tipo: TipoCambio; estado: EstadoCambio }[] | null;
};

export const ENCABEZADOS_TENTATIVAS = [
  "Código",
  "Link Airbnb",
  "Departamento",
  "Check-in",
  "Check-out",
  "Noches",
  "Cuándo",
  "Últimos 4 del teléfono",
  "Aviso del calendario",
  // Desde acá, lo que hay que completar.
  "Nombre del huésped",
  "Teléfono",
  "Adultos",
  "Niños",
  "Bebés",
  "Payout (USD)",
] as const;

/** Columnas (base 1) que se escriben como TEXTO en el Excel. */
export const COLUMNAS_TEXTO = [1, 8, 11] as const;

/** Columnas (base 1) que se escriben como NÚMERO: noches, huéspedes, payout. */
export const COLUMNAS_NUMERO = [6, 12, 13, 14, 15] as const;

/** Desde qué columna (base 1) empieza lo que hay que completar. */
export const PRIMERA_A_COMPLETAR = 10;

export function linkAirbnb(codigo: string): string {
  return `https://www.airbnb.com/hosting/reservations/details/${codigo}`;
}

/** Si la estadía ya pasó, está pasando o todavía no empezó. */
export function cuando(r: Pick<ReservaTentativa, "fecha_checkin" | "fecha_checkout">, hoy: string): string {
  if (r.fecha_checkout && r.fecha_checkout < hoy) return "Pasada";
  if (r.fecha_checkin && r.fecha_checkin <= hoy) return "En curso";
  return "Futura";
}

function ultimos4(raw: unknown): string {
  const valor = (raw as { telefono_ultimos_4?: unknown } | null)?.telefono_ultimos_4;
  return typeof valor === "string" ? valor : "";
}

function numero(valor: number | null): string {
  return valor === null ? "" : String(valor);
}

export function filaTentativa(r: ReservaTentativa, hoy: string): string[] {
  const aviso = cambioPendiente(r.cambios);
  return [
    r.codigo_reserva,
    linkAirbnb(r.codigo_reserva),
    r.depto?.codigo ?? "Sin departamento",
    fechaCorta(r.fecha_checkin),
    fechaCorta(r.fecha_checkout),
    numero(r.noches),
    cuando(r, hoy),
    ultimos4(r.raw),
    aviso ? ETIQUETA_CAMBIO_CALENDARIO[aviso] : "",
    r.huesped_nombre ?? "",
    r.huesped_contacto ?? "",
    numero(r.adultos),
    numero(r.ninos),
    numero(r.bebes),
    numero(r.payout_monto),
  ];
}
