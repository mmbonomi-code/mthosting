/**
 * Verifica el dashboard de ocupación contra la base DEV: que la consulta
 * traiga lo que tiene que traer y que los números cierren con la realidad.
 * No escribe nada.
 */
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import {
  ocupacionPorDepto,
  totalizar,
  type BloqueoOcupacion,
  type ReservaOcupacion,
} from "../lib/dashboard/ocupacion";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("dashboard de ocupación (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const periodo = { desde: "2026-08-01", hasta: "2026-09-01" };

  it("calcula la ocupación del mes con los datos reales", async () => {
    const { data: deptos, error: errorDeptos } = await s
      .from("departamentos")
      .select("id, codigo")
      .eq("estado", "activo")
      .order("codigo");
    expect(errorDeptos).toBeNull();

    const ids = (deptos ?? []).map((d) => d.id);
    // Los departamentos en operación son los que tienen calendario y reservas.
    expect(ids.length).toBeGreaterThan(0);

    const [{ data: reservas, error: e1 }, { data: bloqueos, error: e2 }] =
      await Promise.all([
        s
          .from("reservas")
          .select("depto_id, fecha_checkin, fecha_checkout, cancelada")
          .in("depto_id", ids)
          .eq("descartada", false)
          .lt("fecha_checkin", periodo.hasta)
          .gt("fecha_checkout", periodo.desde),
        s
          .from("bloqueos")
          .select("depto_id, fecha_desde, fecha_hasta")
          .in("depto_id", ids)
          .eq("activo", true)
          .lt("fecha_desde", periodo.hasta)
          .gt("fecha_hasta", periodo.desde),
      ]);
    expect(e1).toBeNull();
    expect(e2).toBeNull();

    const filas = ocupacionPorDepto(
      ids,
      (reservas ?? []) as ReservaOcupacion[],
      (bloqueos ?? []) as BloqueoOcupacion[],
      periodo,
    );
    const total = totalizar(filas);
    const porId = new Map((deptos ?? []).map((d) => [d.id, d.codigo]));

    console.log(
      `agosto 2026 · ${ids.length} deptos · ocupado ${total.pct_ocupado}% ` +
        `(${total.noches_ocupadas} noches) · bloqueado ${total.pct_bloqueado}% ` +
        `(${total.noches_bloqueadas}) · libre ${total.noches_libres} · ` +
        `estadía ${total.estadia_promedio} · cancelación ${total.pct_cancelacion}%`,
    );
    const orden = [...filas].sort((a, b) => b.pct_ocupado - a.pct_ocupado);
    console.log(
      "más ocupados:",
      orden.slice(0, 3).map((f) => `${porId.get(f.depto_id)}=${f.pct_ocupado}%`).join("  "),
    );
    console.log(
      "menos ocupados:",
      orden.slice(-3).map((f) => `${porId.get(f.depto_id)}=${f.pct_ocupado}%`).join("  "),
    );

    // Cada departamento tiene 31 noches en agosto y los tres estados cierran.
    for (const f of filas) {
      expect(f.noches_totales).toBe(31);
      expect(f.noches_ocupadas + f.noches_bloqueadas + f.noches_libres).toBe(31);
      expect(f.pct_ocupado).toBeLessThanOrEqual(100);
      expect(f.pct_ocupado).toBeGreaterThanOrEqual(0);
    }

    expect(total.noches_totales).toBe(ids.length * 31);
    expect(total.pct_ocupado).toBeGreaterThan(0);
    expect(total.pct_ocupado + total.pct_bloqueado).toBeLessThanOrEqual(100);
  });

  it("un mes sin datos da cero, no rompe", async () => {
    const vacio = { desde: "2024-01-01", hasta: "2024-02-01" };
    const { data: deptos } = await s
      .from("departamentos")
      .select("id")
      .eq("estado", "activo");
    const ids = (deptos ?? []).map((d) => d.id);

    const { data: reservas } = await s
      .from("reservas")
      .select("depto_id, fecha_checkin, fecha_checkout, cancelada")
      .in("depto_id", ids)
      .eq("descartada", false)
      .lt("fecha_checkin", vacio.hasta)
      .gt("fecha_checkout", vacio.desde);

    const total = totalizar(
      ocupacionPorDepto(ids, (reservas ?? []) as ReservaOcupacion[], [], vacio),
    );
    expect(total.pct_ocupado).toBe(0);
    expect(total.estadia_promedio).toBeNull();
  });
});
