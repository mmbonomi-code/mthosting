/**
 * Bandeja de reservas sin asignar (spec §2.7): mapear un anuncio a un
 * departamento UNA vez. Crea (o reactiva) el alias, asigna todas las reservas
 * de ese anuncio que estaban sin departamento y les genera lo que les falta.
 *
 * Lo último es la parte que se había olvidado. La importación genera los
 * eventos de check-in y check-out y las limpiezas, pero SALTEA las reservas
 * que no tienen departamento — sin departamento no hay limpieza posible. Como
 * el mapeo se hace después, esas reservas quedaban con su departamento puesto
 * pero sin eventos, y una reserva sin eventos NO APARECE en la pantalla del
 * día: el departamento figuraba asignado y el check-in era invisible hasta la
 * importación siguiente. (Reportado con ARENALES 9, 13/08/2026.)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { generarLimpiezas } from "../limpiezas/generar";
import { hoyAR } from "../fechas";

type Cliente = SupabaseClient<Database>;

export type ResultadoMapeo = {
  reservasAsignadas: number;
  limpiezasGeneradas: number;
  avisos: string[];
};

export async function mapearAnuncio(
  supabase: Cliente,
  nombreListing: string,
  deptoId: string,
): Promise<ResultadoMapeo> {
  // Crea el alias; si ya existía (por ejemplo desactivado desde la ficha),
  // lo reapunta y lo reactiva. Unique en (canal, nombre_listing).
  const { error: errorAlias } = await supabase
    .from("listing_alias")
    .upsert(
      {
        canal: "airbnb",
        nombre_listing: nombreListing,
        depto_id: deptoId,
        activo: true,
      },
      { onConflict: "canal,nombre_listing" },
    );
  if (errorAlias) {
    throw new Error(`No se pudo crear el vínculo del anuncio: ${errorAlias.message}`);
  }

  // Asigna las reservas huérfanas de ese anuncio. Solo las que no tienen
  // departamento: una asignación ya hecha (manual o previa) no se pisa.
  const { data: asignadas, error: errorReservas } = await supabase
    .from("reservas")
    .update({ depto_id: deptoId })
    .eq("listing_nombre_raw", nombreListing)
    .is("depto_id", null)
    .select("id, codigo_reserva");
  if (errorReservas) {
    throw new Error(`No se pudieron asignar las reservas: ${errorReservas.message}`);
  }

  const codigos = (asignadas ?? []).map((r) => r.codigo_reserva);
  if (codigos.length === 0) {
    return { reservasAsignadas: 0, limpiezasGeneradas: 0, avisos: [] };
  }

  // Recién ahora se les puede generar lo suyo: ya tienen departamento.
  const limpiezas = await generarLimpiezas(supabase, codigos, hoyAR());

  return {
    reservasAsignadas: codigos.length,
    limpiezasGeneradas: limpiezas.generadas,
    avisos: limpiezas.anomalias,
  };
}
