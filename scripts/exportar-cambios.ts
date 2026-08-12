/**
 * Genera la planilla de los cambios de moneda históricos para que el dueño
 * complete los dólares y el tipo de cambio de cada uno.
 *
 *   node scripts/exportar-cambios.ts
 *
 * El detalle que trae Ninox (`1430 X 1200`) no es confiable: el orden de los
 * dos números se invierte y en la mitad de los casos el producto no da el
 * monto cargado. Por eso solo se sugiere el par cuando el producto cierra
 * EXACTO; en el resto las celdas van vacías.
 *
 * La columna ID no se toca: es con lo que después se reimporta.
 */
import { writeFileSync } from "node:fs";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";

for (const linea of (await import("node:fs")).readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

const s = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const { data: movimientos, error } = await s
  .from("movimientos_caja")
  .select("id, ref_externa, fecha, monto, descripcion, categoria:categorias_movimiento(nombre)")
  .eq("activo", true)
  .eq("tipo", "ingreso")
  .order("fecha");
if (error) throw error;

const cambios = (movimientos ?? []).filter(
  (m) => m.categoria?.nombre === "CAMBIO URVA",
);

/** `1430 X 1200` → los dos números, en el orden en que aparecen. */
function numerosDelDetalle(detalle: string | null): [number, number] | null {
  const m = (detalle ?? "").match(/(\d[\d.]*)\s*[xX]\s*(\d[\d.]*)/);
  if (!m) return null;
  const a = Number(m[1].replace(/\./g, ""));
  const b = Number(m[2].replace(/\./g, ""));
  return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
}

/**
 * Solo se sugiere si el producto da el monto EXACTO. El dólar es el número
 * más chico y el tipo de cambio el más grande: un TC de tres dígitos no
 * existe en este período y un cambio de 1.400 dólares tampoco es habitual,
 * pero igual queda a la vista para que se revise.
 */
function sugerir(detalle: string | null, monto: number) {
  const par = numerosDelDetalle(detalle);
  if (!par) return null;
  const [a, b] = par;
  if (Math.round(a * b) !== Math.round(monto)) return null;
  const usd = Math.min(a, b);
  const tc = Math.max(a, b);
  return { usd, tc };
}

const libro = new ExcelJS.Workbook();
const hoja = libro.addWorksheet("Cambios");

hoja.columns = [
  { header: "ID", key: "id", width: 30 },
  { header: "FECHA", key: "fecha", width: 12 },
  { header: "PESOS QUE ENTRARON", key: "monto", width: 20 },
  { header: "DETALLE DE NINOX", key: "detalle", width: 34 },
  { header: "DOLARES", key: "usd", width: 12 },
  { header: "TIPO DE CAMBIO", key: "tc", width: 16 },
  { header: "CONTROL (dolares x TC)", key: "control", width: 22 },
  { header: "ESTADO", key: "estado", width: 26 },
];
hoja.getRow(1).font = { bold: true };
hoja.views = [{ state: "frozen", ySplit: 1 }];

let sugeridos = 0;

for (const [i, m] of cambios.entries()) {
  const sugerencia = sugerir(m.descripcion, m.monto);
  if (sugerencia) sugeridos++;

  const fila = hoja.addRow({
    id: m.ref_externa ?? m.id,
    fecha: m.fecha,
    monto: m.monto,
    detalle: m.descripcion ?? "",
    usd: sugerencia?.usd ?? null,
    tc: sugerencia?.tc ?? null,
    estado: sugerencia ? "Sugerido: revisar" : "COMPLETAR",
  });

  const n = i + 2;
  // El control se calcula en la planilla: al corregir un número se ve solo.
  fila.getCell("control").value = { formula: `IF(AND(E${n}<>"",F${n}<>""),E${n}*F${n},"")` };
  fila.getCell("monto").numFmt = "#,##0";
  fila.getCell("control").numFmt = "#,##0";
  fila.getCell("usd").numFmt = "#,##0.##";
  fila.getCell("tc").numFmt = "#,##0.##";

  if (!sugerencia) {
    fila.getCell("estado").font = { color: { argb: "FFB3261E" }, bold: true };
    for (const clave of ["usd", "tc"]) {
      fila.getCell(clave).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFDF1DA" },
      };
    }
  }
}

// Una fila de ayuda al final, separada de los datos.
hoja.addRow({});
hoja.addRow({
  id: "",
  fecha: "",
  monto: "",
  detalle: "La columna CONTROL tiene que dar igual que PESOS QUE ENTRARON.",
});
hoja.addRow({ detalle: "No cambies la columna ID: es con lo que se vuelve a cargar." });

const salida = process.argv[2] ?? "cambios-a-completar.xlsx";
const buffer = await libro.xlsx.writeBuffer();
writeFileSync(salida, Buffer.from(buffer));

console.log(`${cambios.length} cambios exportados a ${salida}`);
console.log(`  con sugerencia (el producto da exacto): ${sugeridos}`);
console.log(`  a completar a mano: ${cambios.length - sugeridos}`);
