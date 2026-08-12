/**
 * Importa la caja histórica de Ninox (GASTOS.csv) a `movimientos_caja`.
 *
 *   node scripts/importar-caja.ts "C:/ruta/GASTOS.csv"
 *
 * Es repetible: cada fila del archivo lleva una `ref_externa` única, así que
 * correrlo dos veces no duplica nada. Al terminar verifica que el saldo de la
 * base coincida con el del archivo; si no coincide, algo salió mal y hay que
 * mirarlo antes de usar el módulo.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import {
  cotizacionesDelArchivo,
  parsearCajaNinox,
  saldoDelArchivo,
  type FilaCaja,
} from "../lib/caja/ninox.ts";
import { pesos } from "../lib/caja/saldo.ts";

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node scripts/importar-caja.ts "ruta/GASTOS.csv"');
  process.exit(1);
}

for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const s = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const filas = parsearCajaNinox(readFileSync(ruta, "utf8"));
console.log(`Archivo: ${filas.length} movimientos · saldo ${pesos(saldoDelArchivo(filas))}\n`);

// --- 1. Departamentos que faltan --------------------------------------------
const { data: deptosExistentes } = await s.from("departamentos").select("id, codigo");
const porCodigo = new Map(
  (deptosExistentes ?? []).map((d) => [d.codigo.toUpperCase(), d.id]),
);

const nombrados = [...new Set(filas.map((f) => f.depto).filter(Boolean))] as string[];
for (const nombre of nombrados) {
  if (porCodigo.has(nombre.toUpperCase())) continue;
  const { data, error } = await s
    .from("departamentos")
    .insert({ codigo: nombre, nombre_interno: nombre, estado: "activo" })
    .select("id, codigo")
    .single();
  if (error) throw new Error(`No se pudo crear ${nombre}: ${error.message}`);
  porCodigo.set(data.codigo.toUpperCase(), data.id);
  console.log(`departamento creado: ${nombre}`);
}

// --- 2. Categorías -----------------------------------------------------------
const categorias = [...new Set(filas.map((f) => f.categoria))].sort();
const { data: catExistentes } = await s.from("categorias_movimiento").select("id, nombre");
const catPorNombre = new Map((catExistentes ?? []).map((c) => [c.nombre, c.id]));

const nuevas = categorias.filter((c) => !catPorNombre.has(c));
if (nuevas.length > 0) {
  const { data, error } = await s
    .from("categorias_movimiento")
    .insert(nuevas.map((nombre) => ({ nombre })))
    .select("id, nombre");
  if (error) throw new Error(`No se pudieron crear las categorías: ${error.message}`);
  for (const c of data) catPorNombre.set(c.nombre, c.id);
}
console.log(`categorías: ${categorias.length} (${nuevas.length} nuevas)`);

// --- 3. Cotizaciones ---------------------------------------------------------
const { cotizaciones, conflictos } = cotizacionesDelArchivo(filas);
if (conflictos.length > 0) {
  console.warn(`ATENCIÓN, fechas con más de una cotización: ${conflictos.join(" | ")}`);
}
if (cotizaciones.length > 0) {
  const { error } = await s
    .from("cotizaciones")
    .upsert(cotizaciones, { onConflict: "fecha" });
  if (error) throw new Error(`No se pudieron cargar las cotizaciones: ${error.message}`);
}
console.log(`cotizaciones: ${cotizaciones.length}`);

// --- 4. Movimientos ----------------------------------------------------------
/** Clave estable por fila del archivo: reimportar no duplica. */
const referencia = (f: FilaCaja, i: number) => `ninox:${i}:${f.fecha}:${f.monto}`;

const sinDeptoPeroReembolsable: string[] = [];

const aInsertar = filas.map((f, i) => {
  const deptoId = f.depto ? (porCodigo.get(f.depto.toUpperCase()) ?? null) : null;

  // La base exige departamento para marcar reembolsable. Dos filas del
  // archivo están marcadas sin departamento (una es de la oficina y otra
  // cubre dos departamentos a la vez): entran sin la marca y se informan.
  const reembolsable = f.reembolsable && deptoId !== null;
  if (f.reembolsable && deptoId === null) {
    sinDeptoPeroReembolsable.push(`${f.fecha} ${f.categoria} — ${f.descripcion}`);
  }

  const detalle = [f.descripcion, f.observacion ? `(${f.observacion})` : null]
    .filter(Boolean)
    .join(" ");

  return {
    ref_externa: referencia(f, i),
    fecha: f.fecha,
    tipo: f.tipo,
    monto: f.monto,
    moneda: "ARS",
    tc: f.tc,
    fecha_tc: f.tc === null ? null : f.fecha,
    descripcion: detalle === "" ? null : detalle,
    categoria_id: catPorNombre.get(f.categoria) ?? null,
    depto_id: deptoId,
    reembolsable,
    fecha_cobro: reembolsable && f.cobrado ? (f.fecha_cobro ?? f.fecha) : null,
    forma_cobro: reembolsable && f.cobrado ? f.forma_cobro : null,
  };
});

let guardados = 0;
for (let i = 0; i < aInsertar.length; i += 200) {
  const tanda = aInsertar.slice(i, i + 200);
  const { error, count } = await s
    .from("movimientos_caja")
    .upsert(tanda, { onConflict: "ref_externa", count: "exact" });
  if (error) throw new Error(`Fila ${i}: ${error.message}`);
  guardados += count ?? tanda.length;
}
console.log(`movimientos guardados: ${guardados}`);

if (sinDeptoPeroReembolsable.length > 0) {
  console.log(
    `\nMarcados como reembolsables en el archivo pero SIN departamento ` +
      `(entraron sin la marca):`,
  );
  for (const t of sinDeptoPeroReembolsable) console.log(`   ${t}`);
}

// --- 5. Verificación ---------------------------------------------------------
const { data: saldoBase, error: errorSaldo } = await s.rpc("saldo_caja");
if (errorSaldo) throw new Error(`No se pudo leer el saldo: ${errorSaldo.message}`);

const esperado = saldoDelArchivo(filas);
console.log(`\nsaldo del archivo: ${pesos(esperado)}`);
console.log(`saldo en la base:  ${pesos(Number(saldoBase))}`);

if (Math.round(Number(saldoBase)) !== Math.round(esperado)) {
  console.error("\nNO COINCIDEN. Revisar antes de usar el módulo.");
  process.exit(1);
}
console.log("\nCoinciden. La caja quedó cargada.");
