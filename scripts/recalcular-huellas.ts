/**
 * Recalcula la huella de los movimientos económicos ya cargados (17/10/2026).
 *
 *   node scripts/recalcular-huellas.ts            (en seco)
 *   node scripts/recalcular-huellas.ts --aplicar  (de verdad)
 *
 * La huella dejó de incluir el texto del anuncio en las filas que traen
 * código de confirmación (ver `claveDeAnuncio` en `lib/economico/parser.ts`).
 * Las filas viejas tienen la huella con la fórmula anterior, así que sin este
 * recálculo el próximo archivo repetido entraría de nuevo como filas nuevas:
 * la deduplicación compara huellas, no contenidos.
 *
 * Seguridad: antes de escribir nada, cada fila se reconstruye con la fórmula
 * VIEJA a partir de `raw`. Si esa reconstrucción no da la huella guardada, la
 * fila no se toca y se informa. Solo se reescribe lo que se pudo verificar.
 *
 * Es idempotente: una fila que ya tiene la huella nueva no se vuelve a tocar.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types.ts";
import {
  claveDeAnuncio,
  huellaDe,
  normalizarTexto,
  repararMojibake,
  SEPARADOR,
} from "../lib/economico/huella.ts";

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
  fecha: string;
  huella: string;
  ocurrencia: number;
  raw: Record<string, string> | null;
};

/** Lo mismo que hace `valor()` en el parser: trim, mojibake, vacío es null. */
function campo(raw: Record<string, string>, nombre: string): string | null {
  const buscado = normalizarTexto(nombre);
  for (const [k, v] of Object.entries(raw)) {
    if (normalizarTexto(k) !== buscado) continue;
    const t = (v ?? "").trim();
    return t === "" ? null : repararMojibake(t);
  }
  return null;
}

function claves(f: Fila): { vieja: string; nueva: string } | null {
  if (!f.raw) return null;
  const tipo = campo(f.raw, "Tipo");
  if (tipo === null) return null;
  const codigo = campo(f.raw, "Código de confirmación");
  const anuncio = campo(f.raw, "Anuncio");
  const comunes = [
    tipo,
    codigo ?? "",
    f.fecha,
    campo(f.raw, "Monto") ?? "",
    campo(f.raw, "Cobrado") ?? "",
    campo(f.raw, "Moneda") ?? "",
  ];
  const detalles = campo(f.raw, "Detalles") ?? "";
  return {
    vieja: [...comunes, anuncio ?? "", detalles].join(SEPARADOR),
    nueva: [...comunes, claveDeAnuncio(codigo, anuncio), detalles].join(SEPARADOR),
  };
}

const filas: Fila[] = [];
for (let desde = 0; ; desde += 1000) {
  const { data, error } = await s
    .from("movimientos_economicos")
    .select("id, fecha, huella, ocurrencia, raw")
    .range(desde, desde + 999);
  if (error) throw new Error(error.message);
  filas.push(...((data ?? []) as Fila[]));
  if ((data ?? []).length < 1000) break;
}
console.log(`filas leídas: ${filas.length}`);

const aCambiar: { id: string; huella: string }[] = [];
let yaEstaban = 0;
let noVerificadas = 0;
for (const f of filas) {
  const c = claves(f);
  if (c === null) {
    noVerificadas++;
    continue;
  }
  const nueva = huellaDe(c.nueva, f.ocurrencia);
  if (f.huella === nueva) {
    yaEstaban++;
    continue;
  }
  // Solo se toca lo que se pudo reproducir con la fórmula vieja.
  if (f.huella !== huellaDe(c.vieja, f.ocurrencia)) {
    noVerificadas++;
    continue;
  }
  aCambiar.push({ id: f.id, huella: nueva });
}

console.log(`a recalcular: ${aCambiar.length}`);
console.log(`ya tenían la huella nueva: ${yaEstaban}`);
console.log(`no se pudieron verificar y quedan como están: ${noVerificadas}`);

// Dos filas vivas no pueden terminar con la misma huella: hay un índice único.
const nuevas = new Map<string, number>();
for (const c of aCambiar) nuevas.set(c.huella, (nuevas.get(c.huella) ?? 0) + 1);
const chocan = [...nuevas.values()].filter((v) => v > 1).length;
console.log(`huellas nuevas que chocarían entre sí: ${chocan}`);

if (!aplicar) {
  console.log("\nEn seco. Para aplicarlo: node scripts/recalcular-huellas.ts --aplicar");
  process.exit(0);
}

// De a 25 en paralelo: son miles de filas y cada una lleva su propio valor,
// así que no hay un UPDATE masivo que sirva.
let hechas = 0;
for (let i = 0; i < aCambiar.length; i += 25) {
  await Promise.all(
    aCambiar.slice(i, i + 25).map(async (c) => {
      const { error } = await s
        .from("movimientos_economicos")
        .update({ huella: c.huella })
        .eq("id", c.id);
      if (error) throw new Error(`${c.id}: ${error.message}`);
      hechas++;
    }),
  );
  if (i % 1000 === 0 && i > 0) console.log(`  ${hechas}...`);
}
console.log(`huellas actualizadas: ${hechas}`);
