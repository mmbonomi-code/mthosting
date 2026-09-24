/**
 * El guardado del reparto de la caja contra la base DEV
 * (20260923210000_cobertura_atomica.sql).
 *
 * El reparto es un dato derivado: rehacerlo no cambia nada si la caja no
 * cambió. Por eso se puede probar sobre los datos reales.
 */
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { recalcularCobertura } from "../lib/caja/recalcular";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("reparto de la caja (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

  async function foto(): Promise<string[]> {
    const { data, error } = await s
      .from("movimiento_cobertura")
      .select("movimiento_id, origen_id, monto, tc");
    if (error) throw error;
    return (data ?? [])
      .map((c) => `${c.movimiento_id}|${c.origen_id}|${c.monto}|${c.tc}`)
      .sort();
  }

  it("dos recálculos seguidos dan exactamente el mismo reparto", async () => {
    const n = await recalcularCobertura(s);
    const primera = await foto();
    expect(primera).toHaveLength(n);
    await recalcularCobertura(s);
    expect(await foto()).toEqual(primera);
  });

  it("dos recálculos al mismo tiempo no duplican nada", async () => {
    const antes = await foto();
    await Promise.all([recalcularCobertura(s), recalcularCobertura(s)]);
    expect(await foto()).toEqual(antes);
  });

  it("un reparto calculado con la caja vieja se rechaza", async () => {
    const { error } = await s.rpc("guardar_cobertura", { p_filas: [], p_firma: "vieja" });
    expect(error?.code).toBe("MT001");
    // Y no borró nada.
    expect((await foto()).length).toBeGreaterThan(0);
  });
});
