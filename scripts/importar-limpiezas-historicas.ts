/**
 * Carga única del listado histórico de limpiezas (LIMPIEZAS.xlsx) en
 * `limpiezas_historicas` (docs/CALIDAD-ESPECIFICACION.md §2.2 y §3.5).
 *
 *   node scripts/importar-limpiezas-historicas.ts "C:/ruta/LIMPIEZAS.xlsx"            ← solo muestra
 *   node scripts/importar-limpiezas-historicas.ts "C:/ruta/LIMPIEZAS.xlsx" --aplicar  ← escribe
 *
 * Sirve SOLO para saber quién limpió antes de cada reseña cuando la limpieza
 * del sistema no tiene responsable. No crea ni asigna limpiezas.
 *
 * Es repetible: la clave es departamento + día + persona, así que correrlo
 * dos veces no duplica nada.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import { leerHojaXlsx } from "../lib/importador/xlsx.ts";
import { leerListado } from "../lib/calidad/listado.ts";

const ruta = process.argv[2];
const aplicar = process.argv.includes("--aplicar");
if (!ruta) {
  console.error('Uso: node scripts/importar-limpiezas-historicas.ts "ruta/LIMPIEZAS.xlsx" [--aplicar]');
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

const buf = readFileSync(ruta);
const filas = await leerHojaXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);

const [{ data: deptos }, { data: personas }] = await Promise.all([
  s.from("departamentos").select("id, codigo"),
  s.from("personas").select("id, nombre"),
]);
const { cargar, descartadas } = leerListado(filas, deptos ?? [], personas ?? []);

const nombreDe = new Map((personas ?? []).map((p) => [p.id, p.nombre]));
const porPersona = new Map<string, number>();
for (const c of cargar) porPersona.set(c.personaId, (porPersona.get(c.personaId) ?? 0) + 1);

console.log(`Listado: ${cargar.length} limpiezas para cargar, ${descartadas.length} filas que no.`);
for (const [id, n] of porPersona) console.log(`  ${nombreDe.get(id)}: ${n}`);
if (descartadas.length > 0) {
  console.log("\nNo se cargan:");
  for (const d of descartadas) console.log(`  fila ${d.fila}: ${d.motivo}`);
}

const atribuidas = async () => {
  const { data } = await s.from("resenas_atribuidas").select("origen_responsable");
  const n = { sistema: 0, listado: 0, sin: 0 };
  for (const r of data ?? []) {
    if (r.origen_responsable === "sistema") n.sistema++;
    else if (r.origen_responsable === "listado") n.listado++;
    else n.sin++;
  }
  return n;
};

const antes = await atribuidas();
console.log(`\nReseñas hoy: ${antes.sistema} por el sistema, ${antes.listado} por el listado, ${antes.sin} sin atribuir.`);

if (!aplicar) {
  console.log("\nNo se escribió nada. Para cargar, agregar --aplicar.");
  process.exit(0);
}

const origen = `listado ${ruta.split(/[\\/]/).pop()}`;
for (let i = 0; i < cargar.length; i += 500) {
  const { error } = await s.from("limpiezas_historicas").upsert(
    cargar.slice(i, i + 500).map((c) => ({
      depto_id: c.deptoId,
      fecha: c.fecha,
      persona_id: c.personaId,
      origen,
    })),
    { onConflict: "depto_id,fecha,persona_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(error.message);
}

// Lo que ya estaba cargado de este archivo y el listado ya no respalda (por
// ejemplo, una equivalencia de nombre que se agregó después) se da de BAJA,
// no se borra (CLAUDE.md regla 3). Y lo que vuelve a respaldar, se reactiva.
const clave = (d: string, f: string, p: string) => `${d}|${f}|${p}`;
const vigentes = new Set(cargar.map((c) => clave(c.deptoId, c.fecha, c.personaId)));
const cargadas: { id: string; depto_id: string; fecha: string; persona_id: string; activo: boolean }[] = [];
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await s
    .from("limpiezas_historicas")
    .select("id, depto_id, fecha, persona_id, activo")
    .eq("origen", origen)
    .order("id")
    .range(desde, desde + 999);
  if (error) throw new Error(error.message);
  cargadas.push(...(data ?? []));
  if (!data || data.length < 1000) break;
}
const bajas = cargadas.filter((c) => c.activo && !vigentes.has(clave(c.depto_id, c.fecha, c.persona_id)));
const altas = cargadas.filter((c) => !c.activo && vigentes.has(clave(c.depto_id, c.fecha, c.persona_id)));
for (const [lista, activo] of [[bajas, false], [altas, true]] as const) {
  for (let i = 0; i < lista.length; i += 200) {
    const { error } = await s
      .from("limpiezas_historicas")
      .update({ activo })
      .in("id", lista.slice(i, i + 200).map((c) => c.id));
    if (error) throw new Error(error.message);
  }
}
if (bajas.length || altas.length) {
  console.log(`\nDadas de baja: ${bajas.length} · reactivadas: ${altas.length}.`);
}

const { count } = await s
  .from("limpiezas_historicas")
  .select("id", { count: "exact", head: true })
  .eq("activo", true);
const despues = await atribuidas();
console.log(`\nCargado. limpiezas_historicas tiene ${count} filas activas.`);
console.log(
  `Reseñas ahora: ${despues.sistema} por el sistema, ${despues.listado} por el listado, ${despues.sin} sin atribuir.`,
);
