/**
 * Cuándo se importaron por última vez los cobros (pedido de Marcos, 22/10/2026).
 *
 * Las pantallas de Económico muestran plata que no se actualiza sola: sale de
 * los CSV de Airbnb que alguien sube a mano. Sin la fecha de la última carga,
 * un número viejo se lee igual que uno fresco. El 17/10 pasó al revés: una
 * importación cambió todos los meses y la pantalla no daba ninguna pista de
 * que algo había entrado.
 *
 * Son dos cargas distintas y conviene verlas separadas:
 *   - COBROS (efectivos): la plata que ya entró.
 *   - PRÓXIMOS COBROS (programados): lo que Airbnb tiene agendado.
 *
 * Los lotes deshechos y los que quedaron sin cerrar no cuentan: no son una
 * carga completa.
 *
 * La función de texto es pura y tiene test; la consulta es un `select` solo.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { diaARDe, formatearFechaAR } from "../fechas";

export type Carga = {
  /** Día de negocio en que se cerró la carga, `YYYY-MM-DD`. */
  fecha: string;
};

export type UltimasCargas = {
  cobros: Carga | null;
  programados: Carga | null;
};

export async function traerUltimasCargas(
  supabase: SupabaseClient<Database>,
): Promise<UltimasCargas> {
  const ultima = async (tipo: "efectivo" | "programado"): Promise<Carga | null> => {
    const { data } = await supabase
      .from("importaciones_economico")
      .select("cerrado_en")
      .eq("tipo", tipo)
      .eq("estado", "vigente")
      .not("cerrado_en", "is", null)
      .order("cerrado_en", { ascending: false })
      .limit(1)
      .maybeSingle();

    const fecha = diaARDe(data?.cerrado_en ?? null);
    return fecha === null ? null : { fecha };
  };

  const [cobros, programados] = await Promise.all([ultima("efectivo"), ultima("programado")]);
  return { cobros, programados };
}

/**
 * La línea para mostrar arriba de los números. `hoy` se pasa desde afuera
 * para que la función no sepa qué día es y se pueda probar.
 *
 * Cuando las dos cargas son del mismo día se dice una sola vez: es lo normal,
 * porque los dos tipos de archivo se suben juntos.
 */
export function textoDeCargas(
  cargas: UltimasCargas,
  hoy: string,
  incluirProgramados = true,
): string {
  const cuando = (c: Carga) =>
    c.fecha === hoy ? "hoy" : `el ${formatearFechaAR(c.fecha)}`;

  const { cobros, programados } = cargas;
  if (cobros === null && (programados === null || !incluirProgramados)) {
    return "Todavía no se importó ningún cobro.";
  }
  if (!incluirProgramados || programados === null) {
    return `Cobros importados ${cuando(cobros!)}.`;
  }
  if (cobros === null) {
    return `Próximos cobros importados ${cuando(programados)}. Todavía no se importó ningún cobro.`;
  }
  if (cobros.fecha === programados.fecha) {
    return `Cobros y próximos cobros importados ${cuando(cobros)}.`;
  }
  return `Cobros importados ${cuando(cobros)} · próximos cobros, ${cuando(programados)}.`;
}
