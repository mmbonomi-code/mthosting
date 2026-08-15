/**
 * Comprueba una pantalla ya migrada a la identidad.
 *
 *   npx next build && node scripts/verificar-identidad.mjs app/(app)/semana/page.tsx ...
 *
 * Dos cosas, y las dos son errores que NO fallan solos:
 *
 *  1. Que cada clase de la identidad exista en el CSS del build. Un token mal
 *     escrito —`bg-superfice`— no rompe nada: la clase no existe, el elemento
 *     queda sin pintar y nadie se entera hasta que alguien mira la pantalla.
 *  2. Que no haya quedado ningún color de la paleta de fábrica. Mientras
 *     conviven las dos, un `bg-slate-800` olvidado en una pantalla clara es un
 *     rectángulo negro, y en una lista larga se pasa por alto.
 *
 * Se corre a mano al terminar cada pantalla. En el último paso, cuando se
 * saque la paleta vieja de Tailwind, el punto 2 lo va a atrapar el compilador
 * y esto queda solo para el punto 1.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const archivos = process.argv.slice(2);
if (archivos.length === 0) {
  console.error("Pasá los archivos a revisar.");
  process.exit(1);
}

/** Los tokens de la identidad. Lo de fábrica de Tailwind no se busca acá. */
const NUESTROS =
  /\b(?:bg|text|border|border-l|ring|fill|from|to|decoration|placeholder)-(?:fondo|superficie|superficie-alt|superficie-hover|tinta|tinta-suave|tinta-tenue|tinta-inversa|borde|borde-fuerte|borde-control|primary|primary-hover|primary-active|primary-soft|primary-soft-text|accent|accent-hover|accent-soft|accent-soft-text|warm-\d{2,3}|exito|exito-soft|exito-text|aviso|aviso-soft|aviso-text|error|error-soft|error-text|dato|dato-soft|dato-text|excepcion-soft|excepcion-text|alerta-soft|alerta-text|alerta-punto)\b/g;

const VIEJOS =
  /\b(?:bg|text|border|border-l|border-y|border-r|ring|decoration|placeholder)-(?:slate|gray|zinc|neutral|stone|emerald|amber|red|violet|sky|blue|green|orange|yellow|purple)-\d{2,3}\b/g;

function buscarCss(dir) {
  const salida = [];
  for (const nombre of readdirSync(dir)) {
    const p = join(dir, nombre);
    if (statSync(p).isDirectory()) salida.push(...buscarCss(p));
    else if (nombre.endsWith(".css") && statSync(p).size > 5000) salida.push(p);
  }
  return salida;
}

let css = "";
try {
  css = buscarCss(".next")
    .map((p) => readFileSync(p, "utf8"))
    .join("\n");
} catch {
  /* sin build */
}
if (css.length === 0) {
  console.error("No se encontró el CSS del build. Corré `npx next build` antes.");
  process.exit(1);
}

const usadas = new Set();
for (const f of archivos) {
  for (const m of readFileSync(f, "utf8").matchAll(NUESTROS)) usadas.add(m[0]);
}

let mal = 0;

const faltan = [...usadas].filter((c) => !css.includes(`.${c}`) && !css.includes(`:${c}`));
console.log(`clases de identidad usadas: ${usadas.size}`);
if (faltan.length === 0) {
  console.log("  todas existen en el CSS");
} else {
  console.log(`  NO EXISTEN (${faltan.length}):`);
  for (const c of faltan.sort()) console.log(`    ${c}`);
  mal += faltan.length;
}

let viejos = 0;
for (const f of archivos) {
  const encontradas = [...readFileSync(f, "utf8").matchAll(VIEJOS)].map((m) => m[0]);
  if (encontradas.length === 0) continue;
  console.log(`\n${f}: quedan ${encontradas.length} colores viejos`);
  for (const c of [...new Set(encontradas)].sort()) console.log(`    ${c}`);
  viejos += encontradas.length;
}
if (viejos === 0) console.log("ningún color viejo en los archivos revisados");
mal += viejos;

process.exit(mal === 0 ? 0 : 1);
