/**
 * Verifica contra la base DEV el ciclo completo de valores de limpieza:
 * cargar un juego con fecha desde, que cierre el anterior, y que cada tipo
 * de limpieza cobre lo que corresponde.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { congelarMonto, type Tarifa } from "../lib/limpiezas/tarifas";
import { sumarDias } from "../lib/fechas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("valores de limpieza (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const creadas: string[] = [];

  afterAll(async () => {
    for (const id of creadas) await s.from("tarifas").delete().eq("id", id);
  });

  it("un juego nuevo cierra el anterior el día previo y rige desde su fecha", async () => {
    const desde1 = "2020-01-01";
    const desde2 = "2020-06-01";

    const { data: primera } = await s
      .from("tarifas")
      .insert({ ambientes: "cuatro", monto: 10000, moneda: "ARS", vigente_desde: desde1 })
      .select("id")
      .single();
    creadas.push(primera!.id);

    // Lo mismo que hace la acción al cargar valores nuevos.
    await s
      .from("tarifas")
      .update({ vigente_hasta: sumarDias(desde2, -1) })
      .eq("ambientes", "cuatro")
      .is("depto_id", null)
      .is("vigente_hasta", null)
      .lt("vigente_desde", desde2);

    const { data: segunda } = await s
      .from("tarifas")
      .insert({ ambientes: "cuatro", monto: 18000, moneda: "ARS", vigente_desde: desde2 })
      .select("id")
      .single();
    creadas.push(segunda!.id);

    const { data: cerrada } = await s
      .from("tarifas")
      .select("monto, vigente_hasta")
      .eq("id", primera!.id)
      .single();
    // El monto viejo NO se toca: solo se le pone fecha de fin.
    expect(Number(cerrada!.monto)).toBe(10000);
    expect(cerrada!.vigente_hasta).toBe("2020-05-31");

    const { data: tarifas } = await s
      .from("tarifas")
      .select("id, ambientes, depto_id, monto, moneda, vigente_desde, vigente_hasta")
      .eq("ambientes", "cuatro");
    const lista = (tarifas ?? []).map((t) => ({ ...t, monto: Number(t.monto) })) as Tarifa[];

    const base = { deptoId: "x", ambientes: "cuatro", tipo: "normal" };
    // Antes del corte rige la vieja; desde la fecha nueva, inclusive, la nueva.
    // Las fechas son días de semana a propósito: un domingo pagaría doble.
    expect(congelarMonto(lista, new Set(), { ...base, fecha: "2020-05-29" }).monto_pactado).toBe(10000);
    expect(congelarMonto(lista, new Set(), { ...base, fecha: desde2 }).monto_pactado).toBe(18000);
  });

  it("cada tipo cobra lo que corresponde", async () => {
    const { data: tarifas } = await s
      .from("tarifas")
      .select("id, ambientes, depto_id, monto, moneda, vigente_desde, vigente_hasta")
      .eq("ambientes", "cuatro")
      .is("vigente_hasta", null);
    const lista = (tarifas ?? []).map((t) => ({ ...t, monto: Number(t.monto) })) as Tarifa[];
    const base = { deptoId: "x", ambientes: "cuatro", fecha: "2026-08-03" }; // lunes

    const casos = [
      { tipo: "normal", esperado: 18000 },
      { tipo: "repaso", esperado: 9000 },
      { tipo: "inicial", esperado: 36000 },
      { tipo: "profunda", esperado: 36000 },
    ];
    for (const caso of casos) {
      const c = congelarMonto(lista, new Set(), { ...base, tipo: caso.tipo });
      console.log(`  ${caso.tipo.padEnd(10)} → ${c.moneda} ${c.monto_pactado}`);
      expect(c.monto_pactado).toBe(caso.esperado);
    }

    // Domingo y feriado duplican los tipos comunes.
    const domingo = congelarMonto(lista, new Set(), {
      ...base,
      fecha: "2026-08-02",
      tipo: "normal",
    });
    console.log(`  normal domingo → ${domingo.monto_pactado}`);
    expect(domingo.monto_pactado).toBe(36000);

    const feriado = congelarMonto(lista, new Set(["2026-08-03"]), {
      ...base,
      tipo: "normal",
    });
    console.log(`  normal feriado → ${feriado.monto_pactado}`);
    expect(feriado.monto_pactado).toBe(36000);
  });
});
