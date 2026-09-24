/**
 * El día operativo: qué llegadas y salidas figuran en una fecha, en qué
 * orden, y si el departamento ya está listo para cada llegada.
 *
 * Lo usan la lista del Día y la ficha de cada evento. Antes cada una hacía
 * su propia cuenta y podían no coincidir: la ficha decía "listo" y la lista
 * no, o las flechas de la ficha recorrían en otro orden que la lista.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { sumarDias } from "../fechas";
import { departamentoListo, momentoDeEvento, type EstadoLimpieza } from "./reglas";

/** Lo mínimo de un evento para ubicarlo y ordenarlo en su día. */
export type EventoDelDia = {
  id: string;
  tipo: "checkin" | "checkout";
  fecha_coordinada: string | null;
  hora_coordinada: string | null;
  reserva: {
    fecha_checkin: string | null;
    fecha_checkout: string | null;
    descartada: boolean;
    depto: { codigo: string } | null;
  } | null;
};

/** Los campos de `EventoDelDia`, para quien solo necesita la secuencia. */
export const CAMPOS_SECUENCIA = `
  id, tipo, fecha_coordinada, hora_coordinada,
  reserva:reservas!inner(fecha_checkin, fecha_checkout, descartada, depto:departamentos(codigo))
`;

/**
 * El día en el que figura el evento es SIEMPRE el de la reserva de Airbnb.
 * Coordinar la llegada para otro día no lo mueve de lugar: se sigue
 * trabajando sobre el día contractual, y la fecha acordada se muestra
 * aparte con la marca "Movido".
 */
export function fechaOperativa(e: EventoDelDia): string | null {
  return e.tipo === "checkin"
    ? (e.reserva?.fecha_checkin ?? null)
    : (e.reserva?.fecha_checkout ?? null);
}

/**
 * Por el momento acordado, no por la hora suelta: las 02:00 del día
 * siguiente van al fondo, no al principio. A igual momento, por depto.
 */
export function ordenarEventos<T extends EventoDelDia>(eventos: T[]): {
  llegadas: T[];
  salidas: T[];
} {
  const momento = (e: T) =>
    momentoDeEvento({
      fechaCoordinada: e.fecha_coordinada,
      horaCoordinada: e.hora_coordinada,
      fechaContractual: fechaOperativa(e),
    });
  const ordenar = (a: T, b: T) =>
    momento(a).localeCompare(momento(b)) ||
    (a.reserva?.depto?.codigo ?? "").localeCompare(b.reserva?.depto?.codigo ?? "");

  return {
    llegadas: eventos.filter((e) => e.tipo === "checkin").sort(ordenar),
    salidas: eventos.filter((e) => e.tipo === "checkout").sort(ordenar),
  };
}

/**
 * Las llegadas y salidas de una fecha, ya ordenadas. `campos` es el select
 * de quien llama y tiene que incluir los de `CAMPOS_SECUENCIA`, con la
 * reserva como `reservas!inner` (el filtro por fecha va sobre ella).
 */
export async function eventosDelDia<T extends EventoDelDia>(
  supabase: SupabaseClient<Database>,
  fecha: string,
  campos: string,
): Promise<{ llegadas: T[]; salidas: T[] }> {
  const { data } = await supabase
    .from("eventos_estadia")
    .select(campos)
    .or(`fecha_checkin.eq.${fecha},fecha_checkout.eq.${fecha}`, {
      referencedTable: "reservas",
    })
    .neq("estado", "cancelado");

  const eventos = ((data ?? []) as unknown as T[]).filter(
    (e) => e.reserva && !e.reserva.descartada && fechaOperativa(e) === fecha,
  );
  return ordenarEventos(eventos);
}

/** Dónde está un evento dentro de la secuencia del día, y sus vecinos. */
export function posicionEnDia(
  secuencia: { id: string; tipo: "checkin" | "checkout" }[],
  id: string,
): {
  anterior: string | null;
  siguiente: string | null;
  /** 1 de N, contado dentro de su tipo: "Llegada 3 de 8". */
  numero: number;
  total: number;
} | null {
  const i = secuencia.findIndex((e) => e.id === id);
  if (i === -1) return null;
  const tipo = secuencia[i].tipo;
  const mismoTipo = secuencia.filter((e) => e.tipo === tipo);
  return {
    anterior: secuencia[i - 1]?.id ?? null,
    siguiente: secuencia[i + 1]?.id ?? null,
    numero: mismoTipo.findIndex((e) => e.id === id) + 1,
    total: mismoTipo.length,
  };
}

/**
 * Cuántos días hacia atrás se mira para decidir "departamento listo".
 *
 * Sin techo, la cuenta traía TODA la historia de limpiezas y salidas de cada
 * depto, y con los años pasaba las 1000 filas que devuelve Supabase: lo que
 * sobraba se cortaba en silencio y el ✓ empezaba a fallar. Con la ventana, si
 * la última salida es más vieja que eso, cualquier limpieza terminada dentro
 * de la ventana es posterior a ella: la respuesta sigue siendo correcta.
 */
export const DIAS_HACIA_ATRAS_LISTO = 60;

/**
 * "Departamento listo" (spec §3.5.bis) para varias llegadas a la vez: dos
 * consultas para toda la lista, no dos por fila. Se mide con las fechas de
 * Airbnb, que son las del día operativo, en la lista y en la ficha.
 */
export async function listoParaLlegadas(
  supabase: SupabaseClient<Database>,
  llegadas: { eventoId: string; deptoId: string; fechaLlegada: string }[],
): Promise<Map<string, boolean>> {
  const resultado = new Map<string, boolean>();
  if (llegadas.length === 0) return resultado;

  const deptos = [...new Set(llegadas.map((l) => l.deptoId))];
  const fechas = llegadas.map((l) => l.fechaLlegada).sort();
  const desde = sumarDias(fechas[0], -DIAS_HACIA_ATRAS_LISTO);
  const hasta = fechas[fechas.length - 1];

  const [{ data: limpiezas }, { data: salidas }] = await Promise.all([
    supabase
      .from("limpiezas")
      .select("depto_id, fecha, estado")
      .in("depto_id", deptos)
      .in("estado", ["hecha", "verificada"])
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("reservas")
      .select("depto_id, fecha_checkout")
      .in("depto_id", deptos)
      .eq("cancelada", false)
      .eq("descartada", false)
      .gte("fecha_checkout", desde)
      .lte("fecha_checkout", hasta),
  ]);

  for (const l of llegadas) {
    const deLimpiezas = (limpiezas ?? [])
      .filter((x) => x.depto_id === l.deptoId)
      .map((x) => ({ fecha: x.fecha, estado: x.estado as EstadoLimpieza }));
    // La última salida hasta el día de esta llegada, inclusive.
    const ultimoCheckout =
      (salidas ?? [])
        .filter((s) => s.depto_id === l.deptoId && s.fecha_checkout && s.fecha_checkout <= l.fechaLlegada)
        .map((s) => s.fecha_checkout as string)
        .sort()
        .at(-1) ?? null;

    resultado.set(
      l.eventoId,
      departamentoListo({
        limpiezas: deLimpiezas,
        ultimoCheckout,
        fechaLlegada: l.fechaLlegada,
      }),
    );
  }
  return resultado;
}

/**
 * El texto buscado, listo para un filtro `ilike` dentro de un `.or()` de
 * PostgREST. Va entre comillas: sin ellas, una coma o un paréntesis
 * ("Pérez, Juan") parten el filtro y la búsqueda da error.
 */
export function patronBusqueda(q: string): string {
  const escapado = q.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"%${escapado}%"`;
}
