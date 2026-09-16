/**
 * Trae de la base lo que `resumirInteraccion` necesita, para varias
 * limpiezas a la vez: dos consultas en total, no dos por limpieza.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { resumirInteraccion, type Interaccion, type PuntoInteraccion } from "./interaccion";

type Cliente = SupabaseClient<Database>;

export type LimpiezaParaInteraccion = {
  id: string;
  depto_id: string;
  fecha: string;
  reserva_id: string | null;
  rol_reserva: string | null;
  hora_checkout: string | null;
};

export async function traerInteracciones(
  supabase: Cliente,
  limpiezas: LimpiezaParaInteraccion[],
): Promise<Map<string, Interaccion>> {
  const resultado = new Map<string, Interaccion>();
  if (limpiezas.length === 0) return resultado;

  const reservasDeSalida = [
    ...new Set(
      limpiezas
        .filter((l) => l.rol_reserva === "salida" && l.reserva_id)
        .map((l) => l.reserva_id!),
    ),
  ];
  const deptos = [...new Set(limpiezas.map((l) => l.depto_id))];
  const fechas = [...new Set(limpiezas.map((l) => l.fecha))];

  const [{ data: salidas }, { data: entradas }] = await Promise.all([
    reservasDeSalida.length > 0
      ? supabase
          .from("eventos_estadia")
          .select(
            `reserva_id, hora_coordinada, fecha_coordinada,
             reserva:reservas(fecha_checkout),
             punto_devolucion:puntos_acceso!eventos_estadia_punto_devolucion_id_fkey(metodo, recibe_limpieza)`,
          )
          .eq("tipo", "checkout")
          .in("reserva_id", reservasDeSalida)
      : Promise.resolve({ data: [] }),
    supabase
      .from("reservas")
      .select(
        `depto_id, fecha_checkin,
         eventos:eventos_estadia(
           tipo, hora_coordinada,
           punto:puntos_acceso!eventos_estadia_punto_acceso_id_fkey(metodo, recibe_limpieza)
         )`,
      )
      .in("depto_id", deptos)
      .in("fecha_checkin", fechas)
      .eq("cancelada", false)
      .eq("descartada", false),
  ]);

  const salidaPorReserva = new Map((salidas ?? []).map((s) => [s.reserva_id, s]));
  const entradaPorDia = new Map(
    (entradas ?? []).map((r) => [`${r.depto_id}|${r.fecha_checkin}`, r]),
  );

  for (const l of limpiezas) {
    const ev = l.reserva_id ? salidaPorReserva.get(l.reserva_id) : undefined;
    const fechaSalida = ev?.fecha_coordinada ?? ev?.reserva?.fecha_checkout ?? null;
    const reservaQueEntra = entradaPorDia.get(`${l.depto_id}|${l.fecha}`);
    const checkin = reservaQueEntra?.eventos?.find((e) => e.tipo === "checkin");

    resultado.set(
      l.id,
      resumirInteraccion({
        fechaLimpieza: l.fecha,
        salida:
          l.rol_reserva === "salida" && fechaSalida
            ? {
                fecha: fechaSalida,
                hora: ev?.hora_coordinada ?? l.hora_checkout,
                puntoDevolucion: (ev?.punto_devolucion ?? null) as PuntoInteraccion,
              }
            : null,
        entrada: reservaQueEntra
          ? {
              hora: checkin?.hora_coordinada ?? null,
              punto: (checkin?.punto ?? null) as PuntoInteraccion,
            }
          : null,
      }),
    );
  }

  return resultado;
}
