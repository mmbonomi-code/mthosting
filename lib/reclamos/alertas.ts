/**
 * Cuántos reclamos hay que mirar hoy: vencidos o a 3 días o menos del plazo
 * (docs/FASE-1-RECLAMOS-ESPECIFICACION.md §2).
 *
 * El mismo número aparece en el menú, en la pantalla de reclamos y en el
 * dashboard, así que se cuenta en un solo lugar.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { hoyAR, sumarDias } from "@/lib/fechas";
import {
  DIAS_DE_AVISO,
  DIAS_PARA_PRESENTAR,
  requiereAtencion,
  semaforoDeReclamo,
  type EstadoReclamo,
} from "./plazos";

/** Estados que todavía corren contra un reloj. */
const CON_PLAZO: EstadoReclamo[] = ["borrador", "por_presentar", "presentado"];

export async function contarReclamosUrgentes(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const hoy = hoyAR();

  // Un reclamo solo puede estar en riesgo si el check-out ya tiene cierta
  // antigüedad: el más corto de los dos plazos define el corte, y así no se
  // traen los que recién empiezan.
  const hasta = sumarDias(hoy, DIAS_DE_AVISO - DIAS_PARA_PRESENTAR);

  const { data } = await supabase
    .from("reclamos")
    .select("estado, reserva:reservas!inner(fecha_checkout)")
    .eq("activo", true)
    .in("estado", CON_PLAZO)
    .lte("reserva.fecha_checkout", hasta);

  return (data ?? []).filter((r) => {
    const { semaforo } = semaforoDeReclamo(
      (r.reserva as { fecha_checkout: string | null } | null)?.fecha_checkout ?? null,
      r.estado as EstadoReclamo,
      hoy,
    );
    return requiereAtencion(semaforo);
  }).length;
}
