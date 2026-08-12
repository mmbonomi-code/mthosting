/**
 * Rehace el reparto de los gastos entre las bolsas y lo guarda.
 *
 * El reparto depende de TODA la historia anterior: si se carga un cambio con
 * fecha del mes pasado, cambia quién pagó cada gasto desde ahí en adelante.
 * Por eso se rehace entero en vez de intentar un ajuste incremental, que
 * sería frágil y difícil de verificar.
 *
 * Con miles de movimientos es una pasada de memoria y unos INSERT en lote.
 * Si algún día la caja crece tanto que esto se note, se optimiza entonces;
 * hoy no es un problema y la alternativa es un cálculo incremental que puede
 * quedar mal sin que nadie se entere.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { repartirCobertura } from "./cobertura";

export async function recalcularCobertura(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const movimientos: {
    id: string;
    fecha: string;
    tipo: "ingreso" | "egreso";
    monto: number;
    tc_cambio: number | null;
  }[] = [];

  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("movimientos_caja")
      .select("id, fecha, tipo, monto, tc_cambio")
      .eq("activo", true)
      .order("fecha")
      .range(desde, desde + 999);
    if (error) throw new Error(`No se pudieron leer los movimientos: ${error.message}`);

    const tanda = (data ?? []) as typeof movimientos;
    movimientos.push(...tanda);
    if (tanda.length < 1000) break;
  }

  const coberturas = repartirCobertura(movimientos);

  const { error: errorBorrado } = await supabase
    .from("movimiento_cobertura")
    .delete()
    .not("id", "is", null);
  if (errorBorrado) {
    throw new Error(`No se pudo limpiar el reparto: ${errorBorrado.message}`);
  }

  for (let i = 0; i < coberturas.length; i += 500) {
    const { error } = await supabase.from("movimiento_cobertura").insert(
      coberturas.slice(i, i + 500).map((c) => ({
        movimiento_id: c.movimiento_id,
        origen_id: c.origen_id,
        monto: c.monto,
        tc: c.tc,
      })),
    );
    if (error) throw new Error(`No se pudo guardar el reparto: ${error.message}`);
  }

  return coberturas.length;
}
