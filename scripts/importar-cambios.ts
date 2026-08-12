/**
 * Carga los dólares y el tipo de cambio de los cambios de moneda históricos,
 * desde la planilla que genera `exportar-cambios.ts`.
 *
 *   node scripts/importar-cambios.ts "C:/ruta/cambios.xlsx"          (revisa)
 *   node scripts/importar-cambios.ts "C:/ruta/cambios.xlsx" --cargar (escribe)
 *
 * Por defecto SOLO revisa e informa: no toca la base hasta que se le pide.
 * Es plata, y un tipo de cambio mal cargado ensucia el costo de todos los
 * gastos que pagó esa bolsa.
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";

/** Diferencia aceptada entre dólares × TC y los pesos que entraron. */
const REDONDEO_ACEPTADO = 1000;

const ruta = process.argv[2];
const cargar = process.argv.includes("--cargar");
if (!ruta) {
  console.error('Uso: node scripts/importar-cambios.ts "ruta.xlsx" [--cargar]');
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

const libro = new ExcelJS.Workbook();
await libro.xlsx.readFile(ruta);
const hoja = libro.worksheets[0];

/** Una celda puede venir como número, texto o fórmula ya calculada. */
function numero(celda: ExcelJS.Cell): number | null {
  const v = celda.value;
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "object" && "result" in v) {
    const r = (v as { result?: unknown }).result;
    return typeof r === "number" && Number.isFinite(r) ? r : null;
  }
  const texto = String(v).replace(/[^\d,.-]/g, "");
  if (texto === "") return null;
  const n = Number(texto.includes(",") ? texto.replace(/\./g, "").replace(",", ".") : texto);
  return Number.isFinite(n) ? n : null;
}

function texto(celda: ExcelJS.Cell): string {
  const v = celda.value;
  return v === null || v === undefined ? "" : String(v).trim();
}

type Fila = { ref: string; fila: number; usd: number; tc: number; diferencia: number };

const listas: Fila[] = [];
const faltantes: string[] = [];
const problemas: string[] = [];

// Los pesos que entraron son la verdad: se leen de la base, no de la planilla.
const { data: enBase, error } = await s
  .from("movimientos_caja")
  .select("id, ref_externa, fecha, monto")
  .eq("activo", true)
  .not("ref_externa", "is", null);
if (error) throw error;
const montoPorRef = new Map((enBase ?? []).map((m) => [m.ref_externa as string, m]));

hoja.eachRow((fila, numeroFila) => {
  if (numeroFila === 1) return;

  const ref = texto(fila.getCell(1));
  if (!ref.startsWith("ninox:")) return; // filas de ayuda del final

  const movimiento = montoPorRef.get(ref);
  if (!movimiento) {
    problemas.push(`fila ${numeroFila}: el ID "${ref}" no existe en la caja`);
    return;
  }

  const usd = numero(fila.getCell(5));
  const tc = numero(fila.getCell(6));

  if (usd === null || tc === null) {
    faltantes.push(`fila ${numeroFila} (${movimiento.fecha})`);
    return;
  }
  if (usd <= 0 || tc <= 0) {
    problemas.push(`fila ${numeroFila}: dólares o tipo de cambio en cero o negativo`);
    return;
  }

  const diferencia = Math.round(usd * tc - movimiento.monto);
  if (Math.abs(diferencia) >= REDONDEO_ACEPTADO) {
    problemas.push(
      `fila ${numeroFila} (${movimiento.fecha}): ${usd} x ${tc} = ` +
        `${Math.round(usd * tc).toLocaleString("es-AR")} pero entraron ` +
        `${movimiento.monto.toLocaleString("es-AR")} · difiere ${diferencia.toLocaleString("es-AR")}`,
    );
    return;
  }

  listas.push({ ref, fila: numeroFila, usd, tc, diferencia });
});

console.log(`planilla: ${ruta}`);
console.log(`  listas para cargar: ${listas.length}`);
console.log(`  sin completar:      ${faltantes.length}`);
console.log(`  con problemas:      ${problemas.length}`);

const redondeo = listas.reduce((a, f) => a + f.diferencia, 0);
console.log(`  redondeo total: ${redondeo.toLocaleString("es-AR")} pesos`);

if (faltantes.length > 0) {
  console.log("\nsin completar:");
  faltantes.slice(0, 20).forEach((t) => console.log(`   ${t}`));
}
if (problemas.length > 0) {
  console.log("\nproblemas:");
  problemas.forEach((t) => console.log(`   ${t}`));
}

if (!cargar) {
  console.log("\nRevisión nada más. Para escribir, agregá --cargar");
  process.exitCode = problemas.length > 0 ? 1 : 0;
} else {
  // Se carga lo que está bien y se deja constancia de lo que no. Un cambio
  // sin dólares queda valuado al dólar del día, que es un default correcto:
  // frenar todo por tres filas sería peor.
  let guardados = 0;
  for (const f of listas) {
    const movimiento = montoPorRef.get(f.ref)!;
    const { error: errorAlta } = await s
      .from("movimientos_caja")
      .update({ usd_cambiado: f.usd, tc_cambio: f.tc })
      .eq("id", movimiento.id);
    if (errorAlta) throw new Error(`${f.ref}: ${errorAlta.message}`);
    guardados++;
  }

  console.log(`\ncambios actualizados: ${guardados}`);
  if (faltantes.length + problemas.length > 0) {
    console.log(
      `quedaron sin cargar ${faltantes.length + problemas.length}: ` +
        `siguen valuándose al dólar del día hasta que se corrijan.`,
    );
  }
}
