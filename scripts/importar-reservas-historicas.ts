/**
 * Carga única de reservas históricas desde el export de Ninox (RESERVAS.csv).
 *
 *   npx tsx scripts/importar-reservas-historicas.ts "C:/ruta/RESERVAS.csv"            ← solo muestra
 *   npx tsx scripts/importar-reservas-historicas.ts "C:/ruta/RESERVAS.csv" --aplicar  ← escribe
 *
 * Decisiones tomadas con el dueño (21/10/2026):
 *   - La clave es el código de reserva. Solo códigos de Airbnb (HM…).
 *   - Si el código YA existe en la base, no se carga ni se modifica nada.
 *   - Solo reservas con check-in anterior al 1/8/2026.
 *   - Sin departamento → no se carga. ED TALC 10 es ED TALC 33.
 *   - Códigos repetidos en el archivo con datos distintos → no se cargan.
 *   - Salida anterior o igual a la entrada → no se carga.
 *   - Canceladas: Estado con "cancel" o "no show".
 *   - NO se generan limpiezas ni eventos: son históricas.
 *   - Las columnas propias de Ninox (responsables, horarios, observaciones)
 *     quedan solo en `raw`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { parsearCSV, parsearFechaDMA } from "../lib/importador/parser";
import { corregirContactoAR } from "../lib/telefono";

const CORTE_CHECKIN = "2026-08-01";

/** Nombre en Ninox → código en la base. */
const DEPTO_NINOX: Record<string, string> = {
  "ED TALC 10": "ED TALC 33",
  "SCALABRINI 1": "SCALABRINI ORTIZ 1",
  "SCALABRINI 2": "SCALABRINI ORTIZ 2",
  "MARCELO T. 1": "MARCELO T 1",
  "MARCELO T. 2": "MARCELO T 2",
};

type Insercion = Database["public"]["Tables"]["reservas"]["Insert"];

function fechaONula(texto: string): string | null {
  try {
    return texto.trim() ? parsearFechaDMA(texto) : null;
  } catch {
    return null;
  }
}

function enteroONulo(texto: string): number | null {
  const n = Number.parseInt(texto.trim(), 10);
  return Number.isNaN(n) ? null : n;
}

/** En este export Ganancias viene con punto decimal y sin símbolo. */
function montoONulo(texto: string): number | null {
  const limpio = texto.trim();
  if (!limpio) return null;
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) throw new Error(`Ganancias con formato desconocido: "${texto}"`);
  return Number.parseFloat(limpio);
}

async function main() {
  const ruta = process.argv[2];
  const aplicar = process.argv.includes("--aplicar");
  if (!ruta) {
    console.error('Uso: npx tsx scripts/importar-reservas-historicas.ts "ruta/RESERVAS.csv" [--aplicar]');
    process.exit(1);
  }

  for (const linea of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  const s = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const contenido = readFileSync(ruta, "utf8");
  const filas = parsearCSV(contenido);
  const encabezado = filas[0].map((c) => c.trim());
  const registros = filas
    .slice(1)
    .map((f) => Object.fromEntries(encabezado.map((c, i) => [c, (f[i] ?? "").trim()])));

  const { data: deptos, error: errorDeptos } = await s.from("departamentos").select("id, codigo");
  if (errorDeptos) throw errorDeptos;
  const deptoPorCodigo = new Map(deptos.map((d) => [d.codigo.toUpperCase(), d.id]));

  const descartes: Record<string, number> = {};
  const descartar = (motivo: string) => (descartes[motivo] = (descartes[motivo] ?? 0) + 1);

  const candidatas: (Insercion & { huella: string })[] = [];
  for (const r of registros) {
    const codigo = r["Código de confirmación"];
    if (!codigo) { descartar("sin código"); continue; }
    if (!/^HM[A-Z0-9]{8}$/.test(codigo)) { descartar("código que no es de Airbnb"); continue; }
    const checkin = fechaONula(r["Fecha de inicio"]);
    const checkout = fechaONula(r["Fecha de finalización"]);
    if (!checkin || !checkout) { descartar("sin fechas válidas"); continue; }
    if (checkin >= CORTE_CHECKIN) { descartar("check-in desde el 1/8/2026"); continue; }
    if (checkout <= checkin) { descartar("salida anterior o igual a la entrada"); continue; }
    const nombreDepto = r["Departamento"];
    if (!nombreDepto) { descartar("sin departamento"); continue; }
    const deptoId = deptoPorCodigo.get((DEPTO_NINOX[nombreDepto] ?? nombreDepto).toUpperCase());
    if (!deptoId) { descartar(`departamento desconocido: ${nombreDepto}`); continue; }

    const contacto = r["Contacto"] || null;
    candidatas.push({
      codigo_reserva: codigo,
      canal: "airbnb",
      origen: "csv",
      datos_completos: true,
      depto_id: deptoId,
      huesped_nombre: r["Nombre del huésped"] || null,
      huesped_contacto: corregirContactoAR(contacto),
      adultos: enteroONulo(r["Número de adultos"]),
      ninos: enteroONulo(r["Número de niños"]),
      bebes: enteroONulo(r["Número de bebés"]),
      noches: enteroONulo(r["Número de noches"]),
      fecha_checkin: checkin,
      fecha_checkout: checkout,
      fecha_reservada: fechaONula(r["Reservada"]),
      cancelada: /cancel|no.?show/i.test(r["Estado"]),
      payout_monto: montoONulo(r["Ganancias"]),
      payout_moneda: "USD",
      raw: r,
      huella: `${deptoId}|${checkin}|${checkout}`,
    });
  }

  // Repetidos dentro del archivo: si coinciden en depto y fechas, se toma la
  // fila más completa; si se contradicen, no se carga ninguna.
  const porCodigo = new Map<string, typeof candidatas>();
  for (const c of candidatas) {
    const grupo = porCodigo.get(c.codigo_reserva) ?? [];
    grupo.push(c);
    porCodigo.set(c.codigo_reserva, grupo);
  }
  const completitud = (c: Insercion) => Object.values(c).filter((v) => v !== null && v !== "").length;
  const unicas: Insercion[] = [];
  const contradictorias: string[] = [];
  for (const [codigo, grupo] of porCodigo) {
    if (new Set(grupo.map((c) => c.huella)).size > 1) {
      contradictorias.push(codigo);
      continue;
    }
    const { huella: _, ...mejor } = grupo.reduce((a, b) => (completitud(b) > completitud(a) ? b : a));
    unicas.push(mejor);
  }

  // Lo que ya existe no se toca.
  const existentes = new Set<string>();
  const codigos = unicas.map((u) => u.codigo_reserva);
  for (let i = 0; i < codigos.length; i += 200) {
    const { data, error } = await s
      .from("reservas")
      .select("codigo_reserva")
      .in("codigo_reserva", codigos.slice(i, i + 200));
    if (error) throw error;
    for (const d of data) existentes.add(d.codigo_reserva);
  }
  const nuevas = unicas.filter((u) => !existentes.has(u.codigo_reserva));

  console.log(`Filas del archivo: ${registros.length}`);
  console.log("Descartadas:", descartes);
  console.log(`Códigos repetidos con datos distintos (no se cargan): ${contradictorias.join(", ")}`);
  console.log(`Ya existen en la base (no se tocan): ${existentes.size}`);
  console.log(`A cargar: ${nuevas.length} (canceladas: ${nuevas.filter((n) => n.cancelada).length})`);

  if (!aplicar) {
    console.log("\nSimulación: no se escribió nada. Agregar --aplicar para cargar.");
    return;
  }

  const { data: importacion, error: errorImport } = await s
    .from("importaciones")
    .insert({
      tipo: "csv",
      archivos: [{ nombre: ruta.split(/[\\/]/).pop(), hash: createHash("sha256").update(contenido).digest("hex") }],
      filas_total: registros.length,
      nuevas: nuevas.length,
      actualizadas: 0,
      sin_cambios: existentes.size,
      sin_asignar: 0,
      canceladas_detectadas: nuevas.filter((n) => n.cancelada).length,
      anomalias: ["Carga histórica desde Ninox: solo altas, sin limpiezas ni eventos."],
    })
    .select("id")
    .single();
  if (errorImport) throw errorImport;

  let cargadas = 0;
  for (let i = 0; i < nuevas.length; i += 500) {
    // ignoreDuplicates = ON CONFLICT DO NOTHING: aunque una reserva aparezca
    // entre la lectura y la escritura, la existente no se modifica.
    const { data, error } = await s
      .from("reservas")
      .upsert(
        nuevas.slice(i, i + 500).map((n) => ({ ...n, import_id: importacion.id })),
        { onConflict: "codigo_reserva", ignoreDuplicates: true },
      )
      .select("id");
    if (error) throw error;
    cargadas += data.length;
  }
  console.log(`\nCargadas: ${cargadas}. Importación ${importacion.id}.`);
}

main();
