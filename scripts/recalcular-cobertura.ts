/**
 * Recalcula qué bolsa pagó cada gasto y lo guarda en `movimiento_cobertura`.
 *
 *   node scripts/recalcular-cobertura.ts
 *
 * El reparto depende de TODA la historia anterior, así que se rehace entero.
 * Con miles de movimientos es una pasada de memoria y unos pocos INSERT en
 * lote; lo que no se hace nunca es recorrer la tabla por cada fila.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import { repartirCobertura, costoEnDolares } from "../lib/caja/cobertura.ts";
import { pesos } from "../lib/caja/saldo.ts";

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const s = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

/** Todos los movimientos activos, en tandas para no chocar con el límite. */
async function todos() {
  const filas: {
    id: string;
    fecha: string;
    tipo: "ingreso" | "egreso";
    monto: number;
    tc_cambio: number | null;
    tc: number | null;
  }[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await s
      .from("movimientos_caja")
      .select("id, fecha, tipo, monto, tc_cambio, tc")
      .eq("activo", true)
      .order("fecha")
      .range(desde, desde + 999);
    if (error) throw error;
    filas.push(...((data ?? []) as typeof filas));
    if ((data ?? []).length < 1000) break;
  }
  return filas;
}

const movimientos = await todos();
console.log(`movimientos: ${movimientos.length}`);

const coberturas = repartirCobertura(
  movimientos.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo,
    monto: m.monto,
    tc_cambio: m.tc_cambio,
  })),
);
console.log(`tramos calculados: ${coberturas.length}`);

// Se rehace entero: es la única forma de que un cambio en una bolsa vieja
// se refleje en todo lo que vino después.
const { error: errorBorrado } = await s
  .from("movimiento_cobertura")
  .delete()
  .not("id", "is", null);
if (errorBorrado) throw errorBorrado;

for (let i = 0; i < coberturas.length; i += 500) {
  const { error } = await s.from("movimiento_cobertura").insert(
    coberturas.slice(i, i + 500).map((c) => ({
      movimiento_id: c.movimiento_id,
      origen_id: c.origen_id,
      monto: c.monto,
      tc: c.tc,
    })),
  );
  if (error) throw new Error(`tramo ${i}: ${error.message}`);
}
console.log("guardados");

// --- Control ---------------------------------------------------------------
// El dólar del día: se queda con el primero que aparece, porque muchos
// movimientos lo tienen vacío y sobrescribirlo con un vacío perdería el dato.
const tcDelDia = new Map<string, number>();
for (const m of movimientos) {
  if (m.tc !== null && !tcDelDia.has(m.fecha)) tcDelDia.set(m.fecha, m.tc);
}
const porMovimiento = new Map<string, typeof coberturas>();
for (const c of coberturas) {
  const lista = porMovimiento.get(c.movimiento_id) ?? [];
  lista.push(c);
  porMovimiento.set(c.movimiento_id, lista);
}

const egresos = movimientos.filter((m) => m.tipo === "egreso");
let conCosto = 0;
let sinCosto = 0;
let totalUsd = 0;
// Los pesos se acumulan SOLO de los gastos que tienen costo: mezclarlos con
// los que no lo tienen infla el promedio y da un tipo de cambio que no
// existió.
let pesosConCosto = 0;
let pesosSinCosto = 0;

for (const g of egresos) {
  const tramos = porMovimiento.get(g.id) ?? [];
  const usd = costoEnDolares(tramos, tcDelDia.get(g.fecha) ?? null);
  if (usd === null) {
    sinCosto++;
    pesosSinCosto += g.monto;
  } else {
    conCosto++;
    totalUsd += usd;
    pesosConCosto += g.monto;
  }
}

console.log(`\negresos con costo en dólares: ${conCosto} · ${pesos(pesosConCosto)}`);
console.log(`egresos sin cotización:      ${sinCosto} · ${pesos(pesosSinCosto)}`);
console.log(
  `costo en dólares: US$ ${totalUsd.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`,
);
if (totalUsd > 0) {
  console.log(
    `tipo de cambio promedio de lo que tiene costo: ${(pesosConCosto / totalUsd).toFixed(2)}`,
  );
}

const partidos = egresos.filter((g) => (porMovimiento.get(g.id) ?? []).length > 1);
console.log(`gastos partidos entre varias bolsas: ${partidos.length}`);
