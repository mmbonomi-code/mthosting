/**
 * Bandeja de reservas sin asignar (spec §2.7): mapear un anuncio a un
 * departamento UNA vez. Crea (o reactiva) el alias y asigna todas las
 * reservas de ese anuncio que estaban sin departamento.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

type Cliente = SupabaseClient<Database>;

export type ResultadoMapeo = {
  reservasAsignadas: number;
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
    .select("id");
  if (errorReservas) {
    throw new Error(`No se pudieron asignar las reservas: ${errorReservas.message}`);
  }

  return { reservasAsignadas: (asignadas ?? []).length };
}
