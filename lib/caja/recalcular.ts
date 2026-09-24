/**
 * Rehace el reparto de los gastos entre las bolsas y lo guarda.
 *
 * El reparto depende de TODA la historia anterior: si se carga un cambio con
 * fecha del mes pasado, cambia quién pagó cada gasto desde ahí en adelante.
 * Por eso se rehace entero en vez de intentar un ajuste incremental, que
 * sería frágil y difícil de verificar.
 *
 * Con miles de movimientos es una pasada de memoria y un solo guardado. El
 * guardado va por `guardar_cobertura()` (migración 20260923210000): borra y
 * vuelve a llenar en una transacción, de a uno por vez, y rechaza el reparto
 * si la caja cambió desde que se leyó. En ese caso se vuelve a calcular.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { repartirCobertura } from "./cobertura";

/** Dos altas simultáneas se resuelven en un reintento; tres es de sobra. */
const INTENTOS = 3;

/** El error con el que la base avisa que la caja cambió mientras tanto. */
const CAJA_CAMBIO = "MT001";

type Movimiento = {
  id: string;
  fecha: string;
  tipo: "ingreso" | "egreso";
  monto: number;
  tc_cambio: number | null;
};

async function leerMovimientos(supabase: SupabaseClient<Database>): Promise<Movimiento[]> {
  const movimientos: Movimiento[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("movimientos_caja")
      .select("id, fecha, tipo, monto, tc_cambio")
      .eq("activo", true)
      // Orden total: con solo la fecha, las filas del mismo día podían
      // repetirse o faltar entre una tanda y la siguiente, y el orden de los
      // gastos de un mismo día (que el reparto respeta) cambiaba de una
      // corrida a otra.
      .order("fecha")
      .order("created_at")
      .order("id")
      .range(desde, desde + 999);
    if (error) throw new Error(`No se pudieron leer los movimientos: ${error.message}`);

    const tanda = (data ?? []) as Movimiento[];
    movimientos.push(...tanda);
    if (tanda.length < 1000) break;
  }
  return movimientos;
}

export async function recalcularCobertura(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  for (let intento = 1; ; intento++) {
    // La huella se toma ANTES de leer: si algo entra después, no coincide.
    const { data: firma, error: errorFirma } = await supabase.rpc("firma_caja");
    if (errorFirma) throw new Error(`No se pudo leer la caja: ${errorFirma.message}`);

    const coberturas = repartirCobertura(await leerMovimientos(supabase));

    const { data: guardadas, error } = await supabase.rpc("guardar_cobertura", {
      p_filas: coberturas.map((c) => ({
        movimiento_id: c.movimiento_id,
        origen_id: c.origen_id,
        monto: c.monto,
        tc: c.tc,
      })),
      p_firma: firma,
    });
    if (!error) return guardadas;
    if (error.code !== CAJA_CAMBIO || intento >= INTENTOS) {
      throw new Error(`No se pudo guardar el reparto: ${error.message}`);
    }
  }
}
