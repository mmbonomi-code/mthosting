/**
 * Ejecuta una importación completa contra la base. Lo usa la pantalla de
 * importación (con el cliente del usuario logueado) y los scripts de
 * verificación (con el cliente de servidor).
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { consolidarLote, decidirUpsert, type ReservaExistente } from "./lote";

type Cliente = SupabaseClient<Database>;
type ActualizacionReserva = Database["public"]["Tables"]["reservas"]["Update"];

export type ResumenImportacion = {
  archivos: number;
  filas_total: number;
  nuevas: number;
  actualizadas: number;
  sin_cambios: number;
  sin_asignar: number;
  canceladas_detectadas: number;
  descartadas_reaparecidas: number;
  anomalias: string[];
  advertencias: string[];
};

const CAMPOS_EXISTENTE =
  "id, codigo_reserva, cancelada, descartada, datos_completos, depto_id, huesped_nombre, huesped_contacto, adultos, ninos, bebes, noches, fecha_checkin, fecha_checkout, fecha_reservada, listing_nombre_raw, payout_monto";

/**
 * Importa un lote ya leído. Parsea TODO antes de escribir: si un archivo
 * está roto, lanza ErrorImportacion y la base no se toca.
 */
export async function ejecutarImportacion(
  supabase: Cliente,
  contenidos: { nombre: string; contenido: string }[],
  usuarioId: string | null,
): Promise<ResumenImportacion> {
  const { filas, advertencias } = consolidarLote(contenidos);

  const { data: aliases, error: errorAliases } = await supabase
    .from("listing_alias")
    .select("nombre_listing, depto_id")
    .eq("canal", "airbnb")
    .eq("activo", true);
  if (errorAliases) throw new Error("No se pudo leer el mapa de anuncios.");
  const deptoPorAnuncio = new Map(
    (aliases ?? []).map((a) => [a.nombre_listing, a.depto_id]),
  );

  const codigos = filas.map((f) => f.codigo_reserva);
  const existentes = new Map<string, ReservaExistente & { codigo_reserva: string }>();
  for (let i = 0; i < codigos.length; i += 200) {
    const { data, error } = await supabase
      .from("reservas")
      .select(CAMPOS_EXISTENTE)
      .in("codigo_reserva", codigos.slice(i, i + 200));
    if (error) throw new Error("No se pudieron leer las reservas existentes.");
    for (const r of data ?? []) existentes.set(r.codigo_reserva, r);
  }

  const { data: importacion, error: errorImport } = await supabase
    .from("importaciones")
    .insert({
      usuario_id: usuarioId,
      archivos: contenidos.map((c) => ({
        nombre: c.nombre,
        hash: createHash("sha256").update(c.contenido).digest("hex"),
      })),
    })
    .select("id")
    .single();
  if (errorImport) throw new Error("No se pudo registrar la importación.");

  const resumen: ResumenImportacion = {
    archivos: contenidos.length,
    filas_total: filas.length,
    nuevas: 0,
    actualizadas: 0,
    sin_cambios: 0,
    sin_asignar: 0,
    canceladas_detectadas: 0,
    descartadas_reaparecidas: 0,
    anomalias: [],
    advertencias,
  };

  const paraInsertar = [];
  const paraActualizar: { id: string; datos: ActualizacionReserva }[] = [];

  for (const fila of filas) {
    const existente = existentes.get(fila.codigo_reserva) ?? null;
    const deptoDeAlias = deptoPorAnuncio.get(fila.listing_nombre_raw) ?? null;
    const decision = decidirUpsert(fila, existente, deptoDeAlias);

    if (decision.tipo === "nueva") {
      resumen.nuevas++;
      if (decision.datos.depto_id === null) resumen.sin_asignar++;
      if (decision.datos.cancelada) resumen.canceladas_detectadas++;
      paraInsertar.push({ ...decision.datos, raw: fila.raw, import_id: importacion.id });
    } else {
      resumen[decision.tipo === "actualizada" ? "actualizadas" : "sin_cambios"]++;
      if (decision.cancelacionDetectada) resumen.canceladas_detectadas++;
      if (decision.reaparecida) resumen.descartadas_reaparecidas++;
      resumen.anomalias.push(...decision.anomalias);

      const quedaSinDepto =
        existente!.depto_id === null && decision.cambios.depto_id === undefined;
      if (quedaSinDepto) resumen.sin_asignar++;

      // raw e import_id se actualizan SIEMPRE, aun sin cambios de datos.
      paraActualizar.push({
        id: decision.id,
        datos: { ...decision.cambios, raw: fila.raw, import_id: importacion.id },
      });
    }
  }

  if (paraInsertar.length > 0) {
    const { error } = await supabase.from("reservas").insert(paraInsertar);
    if (error) throw new Error(`No se pudieron crear las reservas nuevas: ${error.message}`);
  }

  for (const actualizacion of paraActualizar) {
    const { error } = await supabase
      .from("reservas")
      .update(actualizacion.datos)
      .eq("id", actualizacion.id);
    if (error) throw new Error(`No se pudo actualizar una reserva: ${error.message}`);
  }

  await supabase
    .from("importaciones")
    .update({
      filas_total: resumen.filas_total,
      nuevas: resumen.nuevas,
      actualizadas: resumen.actualizadas,
      sin_cambios: resumen.sin_cambios,
      sin_asignar: resumen.sin_asignar,
      canceladas_detectadas: resumen.canceladas_detectadas,
      descartadas_reaparecidas: resumen.descartadas_reaparecidas,
      anomalias: [...resumen.anomalias, ...resumen.advertencias],
    })
    .eq("id", importacion.id);

  return resumen;
}
