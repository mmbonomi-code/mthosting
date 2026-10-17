/**
 * Da de baja los movimientos económicos que entraron dos veces porque les
 * cambiaron el nombre al anuncio (17/10/2026).
 *
 *   node scripts/limpiar-duplicados-por-anuncio.ts            (en seco)
 *   node scripts/limpiar-duplicados-por-anuncio.ts --aplicar  (de verdad)
 *
 * El caso: a tres departamentos de Talcahuano les agregaron un punto en el
 * nombre del anuncio ("Premium depto. en Recoleta 09"). La huella del
 * importador incluía el texto del anuncio, así que la historia entera volvió
 * a entrar como filas nuevas.
 *
 * Qué hace: busca filas vivas que compartan código de reserva, categoría,
 * fecha de pago e importe, deja la MÁS VIEJA y le pone `activo = false` a las
 * demás. Baja lógica, nunca DELETE (CLAUDE.md). El trigger de auditoría deja
 * el registro.
 *
 * Es idempotente: si no hay duplicados, no toca nada.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";

for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const s = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const aplicar = process.argv.includes("--aplicar");

type Fila = {
  id: string;
  categoria: string;
  fecha: string;
  monto: number | null;
  cobrado: number | null;
  codigo_confirmacion: string | null;
  anuncio: string | null;
  depto_id: string | null;
  import_id: string;
  created_at: string;
};

const filas: Fila[] = [];
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await s
    .from("movimientos_economicos")
    .select("id, categoria, fecha, monto, cobrado, codigo_confirmacion, anuncio, depto_id, import_id, created_at")
    .eq("activo", true)
    .range(desde, desde + 999);
  if (error) throw new Error(error.message);
  filas.push(...((data ?? []) as Fila[]));
  if ((data ?? []).length < 1000) break;
}

/** La misma plata: misma reserva, misma categoría, misma fecha, mismo importe. */
const clave = (f: Fila) =>
  [f.codigo_confirmacion, f.categoria, f.fecha, Number(f.monto ?? 0).toFixed(2), Number(f.cobrado ?? 0).toFixed(2)].join("|");

const grupos = new Map<string, Fila[]>();
for (const f of filas) {
  if (!f.codigo_confirmacion) continue; // los payouts no traen código: se dedupe por huella
  const k = clave(f);
  grupos.set(k, [...(grupos.get(k) ?? []), f]);
}

const sobrantes: Fila[] = [];
const sospechosas: Fila[][] = [];
for (const copias of grupos.values()) {
  if (copias.length < 2) continue;
  copias.sort((a, b) => a.created_at.localeCompare(b.created_at));
  const nombres = new Set(copias.map((c) => c.anuncio));
  if (nombres.size === 1) {
    // Mismo anuncio: no es el caso del renombre. Se informa y no se toca.
    sospechosas.push(copias);
    continue;
  }
  sobrantes.push(...copias.slice(1));
}

const { data: deptos } = await s.from("departamentos").select("id, codigo");
const codigo = new Map((deptos ?? []).map((d) => [d.id, d.codigo]));

const porDepto = new Map<string, number>();
const porAnuncio = new Map<string, number>();
const porMes = new Map<string, number>();
for (const f of sobrantes) {
  const d = codigo.get(f.depto_id ?? "") ?? "sin depto";
  porDepto.set(d, (porDepto.get(d) ?? 0) + 1);
  porAnuncio.set(f.anuncio ?? "sin anuncio", (porAnuncio.get(f.anuncio ?? "sin anuncio") ?? 0) + 1);
  porMes.set(f.fecha.slice(0, 7), (porMes.get(f.fecha.slice(0, 7)) ?? 0) + 1);
}

console.log(`\nFilas a dar de baja: ${sobrantes.length}`);
for (const [d, n] of [...porDepto].sort((a, b) => b[1] - a[1])) console.log(`  ${d}: ${n}`);
console.log("Por anuncio:");
for (const [a, n] of [...porAnuncio].sort((a, b) => b[1] - a[1])) console.log(`  ${a}: ${n}`);
console.log("Por mes de cobro:");
for (const [m, n] of [...porMes].sort()) console.log(`  ${m}: ${n}`);

if (sospechosas.length > 0) {
  console.log(`\nGrupos con el MISMO anuncio, que NO se tocan (revisar a mano): ${sospechosas.length}`);
  for (const g of sospechosas.slice(0, 5)) {
    console.log(`  ${g[0].codigo_confirmacion} ${g[0].categoria} ${g[0].fecha} ${g[0].monto} → ${g.length} filas`);
  }
}

if (!aplicar) {
  console.log("\nEn seco. Para aplicarlo: node scripts/limpiar-duplicados-por-anuncio.ts --aplicar");
  process.exit(0);
}

let bajas = 0;
for (let i = 0; i < sobrantes.length; i += 200) {
  const ids = sobrantes.slice(i, i + 200).map((f) => f.id);
  const { data, error } = await s
    .from("movimientos_economicos")
    .update({ activo: false })
    .in("id", ids)
    .select("id");
  if (error) throw new Error(`No se pudieron dar de baja: ${error.message}`);
  bajas += (data ?? []).length;
}
console.log(`\nDadas de baja: ${bajas}`);
