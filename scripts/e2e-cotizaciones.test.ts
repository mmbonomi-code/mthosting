/**
 * Cotizaciones contra la base DEV: que el aviso por tipo de cambio fuera de
 * línea hubiera cazado el caso real (el 144 que se coló por 1440 el
 * 09/06/2026), y que la corrección de una cotización alcance a los
 * movimientos que ya la tenían estampada.
 *
 * Lo segundo se prueba sobre un movimiento de juguete que se borra al final:
 * lo que se verifica es la consulta, que es la parte que los tests unitarios
 * no pueden ver.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { revisarCotizacion } from "../lib/caja/cotizacion";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** El día del error, y una fecha lejana donde no molesta a nadie. */
const DIA_DEL_ERROR = "2026-06-09";
const DIA_DE_JUGUETE = "2099-12-31";

describe.skipIf(!url || !clave)("cotizaciones (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const creados: string[] = [];

  afterAll(async () => {
    for (const id of creados) await s.from("movimientos_caja").delete().eq("id", id);
  });

  async function vecinasDe(fecha: string) {
    const { data } = await s
      .from("cotizaciones")
      .select("fecha, tc")
      .gte("fecha", "2026-04-01")
      .lte("fecha", "2026-08-31");
    expect(data?.length).toBeGreaterThan(5);
    return (data ?? []).filter((c) => c.fecha !== fecha);
  }

  it("con las cotizaciones reales, el 144 del 09/06 hubiera avisado", async () => {
    const desvio = revisarCotizacion(144, DIA_DEL_ERROR, await vecinasDe(DIA_DEL_ERROR));
    expect(desvio).not.toBeNull();
    expect(desvio!.referencia).toBeGreaterThan(1300);
    expect(desvio!.referencia).toBeLessThan(1600);
    expect(desvio!.proporcion).toBeLessThan(-0.8);
  });

  it("el 1440 correcto no hubiera molestado", async () => {
    expect(revisarCotizacion(1440, DIA_DEL_ERROR, await vecinasDe(DIA_DEL_ERROR))).toBeNull();
  });

  it("ninguna cotización cargada se aparta de sus vecinas", async () => {
    const { data } = await s.from("cotizaciones").select("fecha, tc").order("fecha");
    const fuera = (data ?? [])
      .map((c) => ({ ...c, desvio: revisarCotizacion(c.tc, c.fecha, data ?? []) }))
      .filter((c) => c.desvio !== null)
      .map((c) => `${c.fecha}: ${c.tc} (típico ${c.desvio!.referencia})`);
    expect(fuera).toEqual([]);
  });

  it("corregir la cotización alcanza a los movimientos que ya la tenían", async () => {
    const { data: categoria } = await s
      .from("categorias_movimiento")
      .select("id")
      .limit(1)
      .single();

    const { data: creado, error } = await s
      .from("movimientos_caja")
      .insert({
        fecha: DIA_DE_JUGUETE,
        tipo: "egreso",
        monto: 145000,
        moneda: "ARS",
        tc: 100,
        fecha_tc: DIA_DE_JUGUETE,
        categoria_id: categoria!.id,
        descripcion: "prueba automática: corrección de cotización",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    creados.push(creado!.id);

    // La misma consulta que corre `guardarCotizacion` al reemplazar un valor.
    const { count } = await s
      .from("movimientos_caja")
      .update({ tc: 1450, fecha_tc: DIA_DE_JUGUETE }, { count: "exact" })
      .eq("fecha", DIA_DE_JUGUETE)
      .eq("tc", 100);
    expect(count).toBe(1);

    const { data: despues } = await s
      .from("movimientos_caja")
      .select("tc")
      .eq("id", creado!.id)
      .single();
    expect(despues!.tc).toBe(1450);
  });
});
