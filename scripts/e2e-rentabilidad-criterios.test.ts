/**
 * Los dos criterios de costeo de los gastos, contra los datos REALES.
 *
 *   npm run test:e2e -- scripts/e2e-rentabilidad-criterios.test.ts
 *
 * La pantalla de Rentabilidad valúa cada gasto por los cambios de moneda que
 * lo pagaron (BOLSAS). El criterio viejo —la cotización del día del gasto
 * (DÍA)— quedó disponible para comparar. Este test corre los dos sobre la
 * base y muestra la tabla, que es como se decidió el cambio (09/09/2026).
 *
 * No escribe nada: solo lee y compara.
 *
 * Necesita NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY. Si no están
 * en el entorno se leen de `.env.local`; sin eso, el test se saltea.
 */
import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import type { Cobertura } from "../lib/caja/cobertura";
import {
  agregarPorDeptoMes,
  ganancia,
  type ClaseCuenta,
  type FilaAgregable,
} from "../lib/economico/calcular";
import {
  calcularRentabilidad,
  costoDelGasto,
  esGastoReal,
  type GastoCaja,
  type MesRentabilidad,
} from "../lib/economico/rentabilidad";

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  try {
    for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  } catch {
    // Sin .env.local no pasa nada: el test se saltea unas líneas más abajo.
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hayBase = Boolean(url && clave);

/** El mismo arranque que la pantalla: antes son restos de otro sistema. */
const ARRANCA = "2026-02";

/** PostgREST corta en 1000 filas y no avisa: paginar es corrección, no ajuste. */
async function traerTodo<T>(
  s: SupabaseClient<Database>,
  tabla: string,
  campos: string,
  desdeFecha?: string,
): Promise<T[]> {
  const TOPE = 1000;
  const salida: T[] = [];
  for (let desde = 0; ; desde += TOPE) {
    let consulta = s.from(tabla as never).select(campos);
    if (desdeFecha) consulta = consulta.gte("fecha", desdeFecha);
    const { data, error } = await consulta.range(desde, desde + TOPE - 1);
    if (error) throw new Error(`${tabla}: ${error.message}`);
    const tanda = (data ?? []) as T[];
    salida.push(...tanda);
    if (tanda.length < TOPE) break;
  }
  return salida;
}

let gastos: GastoCaja[] = [];
let porBolsas: MesRentabilidad[] = [];
let porDia: MesRentabilidad[] = [];

const total = (filas: MesRentabilidad[], campo: "gastosUsd" | "gastosArs" | "resultadoUsd") =>
  filas.reduce((s, f) => s + f[campo], 0);

beforeAll(async () => {
  if (!hayBase) return;
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

  // ---- La ganancia, con el mismo motor y los mismos campos que la pantalla.
  const crudas = await traerTodo<{
    categoria: FilaAgregable["categoria"];
    monto: number | null;
    cobrado: number | null;
    tarifa_limpieza: number | null;
    moneda: string;
    fecha: string;
    depto_id: string | null;
    cuenta_id: string | null;
    grupo_con_coanfitrion: boolean;
  }>(
    s,
    "movimientos_economicos",
    "categoria, monto, cobrado, tarifa_limpieza, moneda, fecha, depto_id, cuenta_id, grupo_con_coanfitrion",
  );
  const deptos = await traerTodo<{ id: string; comision_pct: number | null }>(
    s,
    "departamentos",
    "id, comision_pct",
  );
  const cuentas = await traerTodo<{ id: string; clasificacion: string | null }>(
    s,
    "cuentas_payout",
    "id, clasificacion",
  );

  const comisionPct = new Map(deptos.map((d) => [d.id, Number(d.comision_pct ?? 20)]));
  const claseDeCuenta = new Map(
    cuentas.map((c) => [c.id, (c.clasificacion ?? "sin_clasificar") as ClaseCuenta]),
  );
  const { celdas } = agregarPorDeptoMes(
    crudas.map((m) => ({
      ...m,
      clase_cuenta:
        m.cuenta_id === null
          ? "sin_clasificar"
          : (claseDeCuenta.get(m.cuenta_id) ?? "sin_clasificar"),
    })),
    comisionPct,
  );
  const gananciaPorMes = new Map<string, number>();
  for (const c of celdas) {
    if (c.mes < ARRANCA) continue;
    gananciaPorMes.set(c.mes, (gananciaPorMes.get(c.mes) ?? 0) + ganancia(c));
  }

  // ---- Los gastos, con los tramos de cambio que los pagaron.
  const gastosCrudos = await traerTodo<GastoCaja & { id: string }>(
    s,
    "movimientos_caja",
    "id, fecha, monto, tc, tipo, reembolsable, activo",
    `${ARRANCA}-01`,
  );
  const tramos = await traerTodo<Cobertura>(
    s,
    "movimiento_cobertura",
    "movimiento_id, origen_id, monto, tc",
  );
  const cotizaciones = await traerTodo<{ fecha: string; tc: number }>(
    s,
    "cotizaciones",
    "fecha, tc",
    `${ARRANCA}-01`,
  );

  const tramosPorGasto = new Map<string, Cobertura[]>();
  for (const t of tramos) {
    tramosPorGasto.set(t.movimiento_id, [...(tramosPorGasto.get(t.movimiento_id) ?? []), t]);
  }
  gastos = gastosCrudos.map((g) => ({ ...g, tramos: tramosPorGasto.get(g.id) ?? [] }));

  porBolsas = calcularRentabilidad(gananciaPorMes, gastos, cotizaciones, ARRANCA, "bolsas");
  porDia = calcularRentabilidad(gananciaPorMes, gastos, cotizaciones, ARRANCA, "dia");

  // ---- La tabla, que es para lo que se corre esto.
  const num = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 0 });
  const col = (t: string, a: number) => t.padStart(a);
  console.log("\nRentabilidad en USD. Gastos al cambio que los pagó vs. al dólar del día\n");
  console.log(
    [col("Mes", 8), col("Ganancia", 10), col("Gastos URVA", 12), col("Gastos día", 11),
     col("Result. URVA", 13), col("Result. día", 12), col("Dif", 7)].join(" "),
  );
  for (const [i, f] of porBolsas.entries()) {
    const d = porDia[i];
    console.log(
      [col(f.mes, 8), col(num(f.gananciaUsd), 10), col(num(f.gastosUsd), 12),
       col(num(d.gastosUsd), 11), col(num(f.resultadoUsd), 13), col(num(d.resultadoUsd), 12),
       col(num(f.gastosUsd - d.gastosUsd), 7)].join(" "),
    );
  }
  console.log(
    [col("TOTAL", 8), col(num(total(porBolsas, "resultadoUsd") + total(porBolsas, "gastosUsd")), 10),
     col(num(total(porBolsas, "gastosUsd")), 12), col(num(total(porDia, "gastosUsd")), 11),
     col(num(total(porBolsas, "resultadoUsd")), 13), col(num(total(porDia, "resultadoUsd")), 12),
     col(num(total(porBolsas, "gastosUsd") - total(porDia, "gastosUsd")), 7)].join(" "),
  );

  // Cuántos gastos se separan de verdad entre un criterio y el otro.
  const reales = gastos.filter((g) => esGastoReal(g) && g.fecha.slice(0, 7) >= ARRANCA);
  const separados = reales.filter((g) => {
    const b = costoDelGasto(g, "bolsas");
    const d = costoDelGasto(g, "dia");
    return b !== null && d !== null && d !== 0 && Math.abs(b - d) / d > 0.005;
  });
  console.log(
    `\nGastos donde los dos criterios se separan más de 0,5%: ${separados.length} de ${reales.length}`,
  );
}, 180000);

describe.skipIf(!hayBase)("los dos criterios de costeo, contra los datos reales", () => {
  it("hay gastos para comparar", () => {
    expect(porBolsas.length).toBeGreaterThan(0);
    expect(total(porBolsas, "gastosUsd")).toBeGreaterThan(0);
  });

  it("los pesos no dependen del criterio: solo cambia con qué dólar se valúan", () => {
    expect(total(porBolsas, "gastosArs")).toBeCloseTo(total(porDia, "gastosArs"), 2);
  });

  it("todos los gastos tienen su reparto de cambios hecho", () => {
    // Si esto falla, hay gastos cargados después del último recálculo de la
    // caja: se están valuando al dólar del día y la pantalla lo avisa.
    const sinReparto = porBolsas.reduce((s, f) => s + f.gastosSinReparto, 0);
    expect(sinReparto).toBe(0);
  });

  it("ningún gasto queda sin poder convertirse a dólares", () => {
    const sinConvertir = porBolsas.reduce((s, f) => s + f.gastosSinConvertir, 0);
    expect(sinConvertir).toBe(0);
  });

  it("los dos criterios no se van a las manos: la diferencia es de segundo orden", () => {
    // No es una verdad eterna, es una alarma: si algún día los cambios se
    // hacen a un dólar muy distinto del cargado, esto salta y hay que mirarlo.
    const bolsas = total(porBolsas, "gastosUsd");
    const dia = total(porDia, "gastosUsd");
    expect(Math.abs(bolsas - dia) / dia).toBeLessThan(0.05);
  });
});
