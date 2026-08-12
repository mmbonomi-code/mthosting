/**
 * Revisa el export de caja de Ninox SIN tocar la base: cuántos movimientos
 * hay, qué saldo dan, qué categorías y qué departamentos aparecen, y qué no
 * se va a poder cruzar. Se corre antes de importar.
 *
 *   node scripts/revisar-caja.ts "C:/ruta/GASTOS.csv"
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  cotizacionesDelArchivo,
  parsearCajaNinox,
  saldoDelArchivo,
} from "../lib/caja/ninox.ts";
import { pesos } from "../lib/caja/saldo.ts";

const ruta = process.argv[2];
if (!ruta) {
  console.error("Falta la ruta del archivo.");
  process.exit(1);
}

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const filas = parsearCajaNinox(readFileSync(ruta, "utf8"));

console.log(`movimientos: ${filas.length}`);
console.log(`  ingresos: ${filas.filter((f) => f.tipo === "ingreso").length}`);
console.log(`  egresos:  ${filas.filter((f) => f.tipo === "egreso").length}`);
console.log(`  rango: ${filas[0].fecha} → ${filas[filas.length - 1].fecha}`);
console.log(`  SALDO: ${pesos(saldoDelArchivo(filas))}`);

const categorias = [...new Set(filas.map((f) => f.categoria))].sort();
console.log(`\ncategorías (${categorias.length}): ${categorias.join(" · ")}`);

const { cotizaciones, conflictos } = cotizacionesDelArchivo(filas);
console.log(`\ncotizaciones deducibles: ${cotizaciones.length}`);
console.log(`  conflictos: ${conflictos.length}`, conflictos);
console.log(`  movimientos sin cotización: ${filas.filter((f) => f.tc === null).length}`);

const reemb = filas.filter((f) => f.reembolsable);
const pendientes = reemb.filter((f) => !f.cobrado);
console.log(`\nreembolsables: ${reemb.length}`);
console.log(`  cobrados:   ${reemb.length - pendientes.length}`);
console.log(`  pendientes: ${pendientes.length} · ${pesos(pendientes.reduce((s, f) => s + f.monto, 0))}`);

const sinDepto = reemb.filter((f) => !f.depto);
if (sinDepto.length > 0) {
  console.log(`  reembolsables sin departamento: ${sinDepto.length}`);
  for (const f of sinDepto) console.log(`     ${f.fecha} ${f.categoria} — ${f.descripcion}`);
}

// Cruce con los departamentos del sistema.
const s = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);
const { data: deptos } = await s.from("departamentos").select("codigo");
const codigos = new Set((deptos ?? []).map((d) => d.codigo.toUpperCase()));
const nombrados = [...new Set(filas.map((f) => f.depto).filter(Boolean))] as string[];
const sinCruce = nombrados.filter((n) => !codigos.has(n.toUpperCase()));

console.log(`\ndepartamentos nombrados: ${nombrados.length}`);
console.log(`  sin cruce en el sistema: ${sinCruce.length}${sinCruce.length ? " → " + sinCruce.join(", ") : ""}`);
