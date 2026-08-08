/**
 * Exportables de contactos de huéspedes (spec §3.5).
 *
 * Dos formatos con el mismo filtro —rango sobre la fecha de check-in— y las
 * mismas exclusiones: canceladas (Airbnb borra el teléfono) y reservas sin
 * departamento asignado.
 *
 * Funciones puras, con tests: el teléfono y el país son donde un error pasa
 * inadvertido y rompe el archivo en destino.
 */

import { agregarNueveAR, soloDigitos } from "../telefono";

/**
 * Todo lo que no sea dígito se descarta: `+55 38 99940-9246` → `553899409246`.
 * A los argentinos se les completa el 9 que Airbnb no manda, por si quedó
 * alguno sin corregir en la base: el archivo que sale de acá tiene que servir
 * para llamar y para WhatsApp.
 */
export function normalizarTelefono(contacto: string | null): string | null {
  const digitos = soloDigitos(contacto);
  return digitos === null ? null : agregarNueveAR(digitos);
}

/**
 * País ISO-2 según el código telefónico. Se prueban primero los códigos
 * largos, porque 598 (Uruguay) empieza igual que 59 y 5.
 *
 * `+1` queda VACÍO a propósito: es Estados Unidos y Canadá a la vez y no se
 * pueden distinguir. Cualquier código no listado, también vacío.
 */
const PAISES: Record<string, string> = {
  "598": "UY",
  "595": "PY",
  "591": "BO",
  "351": "PT",
  "972": "IL",
  "54": "AR",
  "55": "BR",
  "56": "CL",
  "34": "ES",
  "52": "MX",
  "51": "PE",
  "57": "CO",
  "33": "FR",
  "39": "IT",
  "44": "GB",
  "49": "DE",
  "31": "NL",
  "61": "AU",
};

export function paisDesdeTelefono(telefono: string | null): string {
  if (!telefono) return "";
  for (const largo of [3, 2]) {
    const pais = PAISES[telefono.slice(0, largo)];
    if (pais) return pais;
  }
  return "";
}

/** `2026-08-15` → `15/08/2026`. */
export function fechaCorta(fechaISO: string | null): string {
  if (!fechaISO) return "";
  const [a, m, d] = fechaISO.split("-");
  return `${d}/${m}/${a}`;
}

export type ReservaContacto = {
  codigo_reserva: string;
  huesped_nombre: string | null;
  huesped_contacto: string | null;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  depto: { nombre_interno: string } | null;
};

/** Encabezados exactos del sistema de comunicación, en este orden. */
export const ENCABEZADOS_COMUNICACION = [
  "Nombre",
  "Celular",
  "Email",
  "Direccion",
  "Genero",
  "Ciudad",
  "Pais",
  "Apellidos",
  "Autoasignar Tipo",
  "Autoasignar Id",
  "Etiquetas",
  "Documento",
  "Extra 1",
  "Extra 2",
] as const;

/**
 * Una fila por reserva para el sistema de comunicación. El "Celular" se
 * escribe después como TEXTO: un teléfono largo guardado como número se
 * convierte en notación científica y el archivo llega roto.
 */
export function filaComunicacion(r: ReservaContacto): string[] {
  const telefono = normalizarTelefono(r.huesped_contacto);
  return [
    r.huesped_nombre ?? "",
    telefono ?? "",
    "", // Email
    "", // Direccion
    "", // Genero
    r.codigo_reserva, // Ciudad
    paisDesdeTelefono(telefono),
    r.depto?.nombre_interno ?? "", // Apellidos
    "", // Autoasignar Tipo
    "", // Autoasignar Id
    "", // Etiquetas
    "", // Documento
    fechaCorta(r.fecha_checkin), // Extra 1
    fechaCorta(r.fecha_checkout), // Extra 2
  ];
}

export const ENCABEZADOS_GOOGLE = [
  "Name",
  "Given Name",
  "Family Name",
  "Phone 1 - Type",
  "Phone 1 - Value",
  "Notes",
] as const;

/**
 * Una fila por reserva para Google Contacts. El nombre junta huésped y
 * departamento para que, al entrar la llamada, el celular muestre los dos.
 */
export function filaGoogle(r: ReservaContacto): string[] {
  const telefono = normalizarTelefono(r.huesped_contacto);
  const depto = r.depto?.nombre_interno ?? "";
  const huesped = r.huesped_nombre ?? "";
  return [
    [huesped, depto].filter(Boolean).join(" "),
    huesped,
    depto,
    "Mobile",
    telefono ? `+${telefono}` : "",
    `${r.codigo_reserva} · ${fechaCorta(r.fecha_checkin)} a ${fechaCorta(r.fecha_checkout)}`,
  ];
}

/** CSV con comillas donde hagan falta y BOM para que Excel lo abra bien. */
export function armarCSV(encabezados: readonly string[], filas: string[][]): string {
  const escapar = (valor: string) =>
    /[",\n\r]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
  const lineas = [encabezados, ...filas].map((f) => f.map(escapar).join(","));
  return "﻿" + lineas.join("\r\n") + "\r\n";
}
