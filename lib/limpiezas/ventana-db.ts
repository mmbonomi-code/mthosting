/**
 * `urgente` y `prox_checkin` de una limpieza de salida, medidos desde el día
 * en que se limpia. Lo usan las acciones que le cambian la fecha a mano: el
 * planificador hace la misma cuenta al importar (`planificar.ts`), pero entre
 * importación e importación la marca quedaba vieja.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { calcularVentana, type Ventana } from "./ventana";

export async function ventanaDesde(
  supabase: SupabaseClient<Database>,
  deptoId: string,
  fecha: string,
  reservaId: string | null,
): Promise<Ventana> {
  let consulta = supabase
    .from("reservas")
    .select("fecha_checkin")
    .eq("depto_id", deptoId)
    .eq("cancelada", false)
    .eq("descartada", false)
    .gte("fecha_checkin", fecha)
    .order("fecha_checkin", { ascending: true })
    .limit(1);
  if (reservaId) consulta = consulta.neq("id", reservaId);

  const { data } = await consulta.maybeSingle();
  return calcularVentana(fecha, [data?.fecha_checkin ?? null]);
}
