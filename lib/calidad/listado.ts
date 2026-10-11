/**
 * El listado histórico de limpiezas (LIMPIEZAS.xlsx, 29/05 a 03/09/2026):
 * quién limpió qué departamento qué día, de antes de que las limpiezas se
 * asignaran en el sistema (docs/CALIDAD-ESPECIFICACION.md §2.2 y §3.5).
 *
 * Sirve SOLO para atribuir reseñas. No crea ni asigna limpiezas: asignar
 * copia el monto pactado y eso termina en pagos.
 *
 * PURA: recibe las filas como texto, los departamentos y las personas, y
 * devuelve qué se carga y qué no, con el motivo.
 */

import { parsearFecha } from "./parser.ts";

/**
 * Nombres del listado que no coinciden con el código del sistema
 * (confirmadas por el dueño, 07/10/2026). `MARCELO T. 1` vs `MARCELO T 1` no
 * hace falta: la normalización ya saca los puntos.
 */
export const EQUIVALENCIAS_DEPTO: Record<string, string> = {
  "ED TALC 10": "ED TALC 33",
  // En el listado figura como JUNCAL 1 hasta el 17/08 y como JUNCAL 2 desde
  // el 22/08: es el mismo departamento, el JUNCAL 2 del sistema (dueño,
  // 11/10/2026). El JUNCAL 1 del sistema no tuvo reservas en ese período.
  "JUNCAL 1": "JUNCAL 2",
};

/** Mayúsculas, sin tildes, sin puntos y con un solo espacio. */
export function normalizarNombre(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\./g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type FilaListado = { fila: number; fecha: string; deptoId: string; personaId: string };
export type Descartada = { fila: number; motivo: string };

export function leerListado(
  filas: string[][],
  deptos: { id: string; codigo: string }[],
  personas: { id: string; nombre: string }[],
): { cargar: FilaListado[]; descartadas: Descartada[] } {
  const inicio = filas.findIndex((f) => f.some((c) => c.trim() !== ""));
  if (inicio < 0) return { cargar: [], descartadas: [] };

  const encabezado = filas[inicio].map(normalizarNombre);
  const cFecha = encabezado.indexOf("FECHA");
  const cDepto = encabezado.indexOf("DEPTO");
  const cResp = encabezado.findIndex((h) => h.startsWith("RESP"));
  if (cFecha < 0 || cDepto < 0 || cResp < 0) {
    throw new Error('No parece el listado de limpiezas: faltan las columnas "FECHA", "DEPTO" o "RESP".');
  }

  const deptoDe = new Map(deptos.map((d) => [normalizarNombre(d.codigo), d.id]));
  const personaDe = new Map(personas.map((p) => [normalizarNombre(p.nombre), p.id]));
  for (const [listado, sistema] of Object.entries(EQUIVALENCIAS_DEPTO)) {
    const id = deptoDe.get(normalizarNombre(sistema));
    if (id) deptoDe.set(normalizarNombre(listado), id);
  }

  const leidas: FilaListado[] = [];
  const descartadas: Descartada[] = [];
  for (let i = inicio + 1; i < filas.length; i++) {
    const f = filas[i];
    const numero = i + 1;
    if (!f || f.every((c) => c.trim() === "")) continue;

    const fecha = parsearFecha(f[cFecha] ?? "");
    const depto = normalizarNombre(f[cDepto] ?? "");
    const resp = normalizarNombre(f[cResp] ?? "");
    if (!fecha) {
      descartadas.push({ fila: numero, motivo: `Fecha ilegible: "${f[cFecha] ?? ""}".` });
      continue;
    }
    const deptoId = deptoDe.get(depto);
    if (!deptoId) {
      descartadas.push({ fila: numero, motivo: `Departamento desconocido: "${f[cDepto] ?? ""}".` });
      continue;
    }
    const personaId = personaDe.get(resp);
    if (!personaId) {
      descartadas.push({ fila: numero, motivo: `${f[cResp]} no está en Personal.` });
      continue;
    }
    leidas.push({ fila: numero, fecha, deptoId, personaId });
  }

  // Un mismo departamento y día con dos personas distintas es un error del
  // listado: una limpieza la hace una sola persona (dueño, 07/10/2026). No se
  // elige ninguna. La misma persona dos veces es la misma limpieza.
  const porDia = new Map<string, FilaListado[]>();
  for (const l of leidas) {
    const clave = `${l.deptoId}|${l.fecha}`;
    porDia.set(clave, [...(porDia.get(clave) ?? []), l]);
  }
  const cargar: FilaListado[] = [];
  for (const grupo of porDia.values()) {
    const personas = new Set(grupo.map((g) => g.personaId));
    if (personas.size > 1) {
      for (const g of grupo) {
        descartadas.push({
          fila: g.fila,
          motivo: `El mismo día y departamento figura con dos personas distintas (filas ${grupo
            .map((x) => x.fila)
            .join(" y ")}).`,
        });
      }
      continue;
    }
    cargar.push(grupo[0]);
  }

  descartadas.sort((a, b) => a.fila - b.fila);
  return { cargar, descartadas };
}
