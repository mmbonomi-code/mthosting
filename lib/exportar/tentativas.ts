/**
 * Excel de tentativas y posibles cancelaciones (decisión del dueño,
 * 13/09/2026).
 *
 * Desde que Airbnb sacó la exportación del archivo de reservas, las que
 * descubre el calendario se quedan sin nombre, teléfono ni huéspedes, y las
 * que desaparecen del calendario quedan como "¿Cancelada?". Este archivo las
 * lista a TODAS con el link a cada una en Airbnb, se completa por fuera y se
 * vuelve a subir desde /importar (lib/importador/tentativas.ts).
 *
 * Entran: las tentativas (datos_completos = false) y las que tienen una
 * posible cancelación pendiente, aunque ya tengan sus datos. No entran las
 * canceladas ni las descartadas.
 *
 * Las columnas a completar ya vienen con lo que el sistema tenga. El payout
 * no va (decisión del dueño, 13/09/2026).
 *
 * Funciones puras, con tests. Los encabezados son el contrato con el
 * importador: si se cambian acá, el Excel viejo deja de poder subirse.
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
  // Desde acá, lo que se completa y se vuelve a subir.
  "Estado en Airbnb",
  "Nombre del huésped",
  "Teléfono",
  "Adultos",
  "Niños",
  "Bebés",
] as const;

/** Lo que se puede elegir en "Estado en Airbnb". Vacío: no se toca. */
export const ESTADOS_AIRBNB = ["Confirmada", "Cancelada"] as const;

/** Columnas (base 1) que se escriben como TEXTO en el Excel. */
export const COLUMNAS_TEXTO = [1, 8, 12] as const;

/** Columnas (base 1) que se escriben como NÚMERO: noches y huéspedes. */
export const COLUMNAS_NUMERO = [6, 13, 14, 15] as const;

/** Desde qué columna (base 1) empieza lo que hay que completar. */
export const PRIMERA_A_COMPLETAR = 10;

/** La columna (base 1) de "Estado en Airbnb", la de la lista desplegable. */
export const COLUMNA_ESTADO = 10;

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
    "", // Estado en Airbnb: lo elige quien lo mira en Airbnb.
    r.huesped_nombre ?? "",
    r.huesped_contacto ?? "",
    numero(r.adultos),
    numero(r.ninos),
    numero(r.bebes),
  ];
}
