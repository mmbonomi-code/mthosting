/**
 * Aplica contra la base el Excel de tentativas completado
 * (lib/importador/tentativas.ts tiene las reglas y sus tests).
 *
 * Lee TODO y decide antes de escribir: si el archivo tiene un error, lanza
 * ErrorImportacion y la base no se toca. Las cancelaciones y los "sigue en
 * pie" usan el mismo camino que los botones de Alertas, así que se comportan
 * igual: la cancelación se lleva la limpieza y los eventos, con la excepción
 * de siempre.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { confirmarCambioEnBase, descartarCambioEnBase } from "../ical/confirmar";
import { firmaCambio } from "../ical/cambios";
import { hoyAR } from "../fechas";
import {
  decidirFilaExcel,
  leerExcelTentativas,
  type MarcaCancelacion,
  type ReservaParaExcel,
} from "./tentativas";

type Cliente = SupabaseClient<Database>;

export type ResumenExcelTentativas = {
  filas: number;
  datosActualizados: number;
  dejaronDeSerTentativas: number;
  canceladas: number;
  aConfirmarEnAlertas: number;
  siguenEnPie: number;
  sinCambios: number;
  avisos: string[];
};

export async function ejecutarExcelTentativas(
  supabase: Cliente,
  archivo: { nombre: string; filas: string[][]; bytes: ArrayBuffer },
  usuario: { id: string | null; personaId: string | null },
): Promise<ResumenExcelTentativas> {
  const filas = leerExcelTentativas(archivo.filas);
  const codigos = filas.map((f) => f.codigo);

  const reservas = new Map<string, ReservaParaExcel & { depto_id: string | null; fecha_checkin: string | null; fecha_checkout: string | null }>();
  for (let i = 0; i < codigos.length; i += 200) {
    const { data, error } = await supabase
      .from("reservas")
      .select(
        "id, codigo_reserva, cancelada, descartada, datos_completos, huesped_nombre, huesped_contacto, adultos, ninos, bebes, depto_id, fecha_checkin, fecha_checkout",
      )
      .in("codigo_reserva", codigos.slice(i, i + 200));
    if (error) throw new Error(`No se pudieron leer las reservas: ${error.message}`);
    for (const r of data ?? []) reservas.set(r.codigo_reserva, r);
  }

  const ids = [...reservas.values()].map((r) => r.id);
  const marcas = new Map<string, MarcaCancelacion>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data, error } = await supabase
      .from("cambios_calendario")
      .select("id, reserva_id, origen")
      .in("reserva_id", ids.slice(i, i + 200))
      .eq("tipo", "posible_cancelacion")
      .eq("estado", "pendiente");
    if (error) throw new Error(`No se pudieron leer las marcas del calendario: ${error.message}`);
    for (const m of data ?? []) {
      marcas.set(m.reserva_id, { id: m.id, origen: m.origen === "excel" ? "excel" : "calendario" });
    }
  }

  const decisiones = filas.map((f) => {
    const reserva = reservas.get(f.codigo);
    return decidirFilaExcel(f, reserva, reserva ? marcas.get(reserva.id) : undefined);
  });

  const resumen: ResumenExcelTentativas = {
    filas: filas.length,
    datosActualizados: 0,
    dejaronDeSerTentativas: 0,
    canceladas: 0,
    aConfirmarEnAlertas: 0,
    siguenEnPie: 0,
    sinCambios: 0,
    avisos: decisiones.map((d) => d.aviso).filter((a): a is string => a !== null),
  };

  const hoy = hoyAR();

  for (const d of decisiones) {
    if (!d.reserva_id) continue;
    const reserva = reservas.get(d.codigo)!;
    let hizoAlgo = false;

    if (Object.keys(d.cambios).length > 0) {
      const { error } = await supabase.from("reservas").update(d.cambios).eq("id", d.reserva_id);
      if (error) {
        resumen.avisos.push(`${d.codigo}: no se pudieron guardar los datos (${error.message}).`);
      } else {
        hizoAlgo = true;
        resumen.datosActualizados++;
        if (d.cambios.datos_completos) resumen.dejaronDeSerTentativas++;
      }
    }

    if (d.accion?.tipo === "cancelar") {
      const r = await confirmarCambioEnBase(supabase, d.accion.marca_id, usuario.personaId, hoy);
      if ("error" in r) resumen.avisos.push(`${d.codigo}: ${r.error}`);
      else {
        hizoAlgo = true;
        resumen.canceladas++;
        resumen.avisos.push(...r.anomalias);
      }
    } else if (d.accion?.tipo === "sigue_en_pie") {
      const r = await descartarCambioEnBase(supabase, d.accion.marca_id, usuario.personaId);
      if ("error" in r) resumen.avisos.push(`${d.codigo}: ${r.error}`);
      else {
        hizoAlgo = true;
        resumen.siguenEnPie++;
      }
    } else if (d.accion?.tipo === "marcar_cancelacion") {
      if (!reserva.depto_id || !reserva.fecha_checkin || !reserva.fecha_checkout) {
        resumen.avisos.push(`${d.codigo}: no tiene departamento o fechas, así que no se puede marcar. Cancelala desde su ficha.`);
      } else {
        const comparable = {
          id: reserva.id,
          codigo_reserva: reserva.codigo_reserva,
          depto_id: reserva.depto_id,
          fecha_checkin: reserva.fecha_checkin,
          fecha_checkout: reserva.fecha_checkout,
        };
        const { error } = await supabase.from("cambios_calendario").insert({
          reserva_id: reserva.id,
          tipo: "posible_cancelacion",
          origen: "excel",
          firma: firmaCambio("posible_cancelacion", comparable, undefined),
          reserva_checkin: comparable.fecha_checkin,
          reserva_checkout: comparable.fecha_checkout,
          reserva_depto_id: comparable.depto_id,
        });
        if (error) resumen.avisos.push(`${d.codigo}: no se pudo mandar a Alertas (${error.message}).`);
        else {
          hizoAlgo = true;
          resumen.aConfirmarEnAlertas++;
        }
      }
    }

    if (!hizoAlgo) resumen.sinCambios++;
  }

  await supabase.from("importaciones").insert({
    tipo: "excel_tentativas",
    usuario_id: usuario.id,
    archivos: [
      {
        nombre: archivo.nombre,
        hash: createHash("sha256").update(Buffer.from(archivo.bytes)).digest("hex"),
      },
    ],
    filas_total: resumen.filas,
    actualizadas: resumen.datosActualizados,
    sin_cambios: resumen.sinCambios,
    canceladas_detectadas: resumen.canceladas,
    anomalias: resumen.avisos,
  });

  return resumen;
}
