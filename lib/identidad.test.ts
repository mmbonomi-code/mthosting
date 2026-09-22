import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * La identidad en el código (docs/IDENTIDAD-VISUAL.md).
 *
 * globals.css apaga la paleta de fábrica de Tailwind: una clase como
 * `bg-slate-800` o un token mal escrito no rompe el build, simplemente
 * no pinta nada. Estos tests son los que avisan.
 */

const RAIZ = path.resolve(__dirname, "..");

function archivos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return archivos(p);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") ? [p] : [];
  });
}

const FUENTES = [...archivos(path.join(RAIZ, "app")), ...archivos(path.join(RAIZ, "lib"))]
  // El logo lleva sus colores fijos a propósito: no se tocan.
  .filter((f) => !f.endsWith(path.join("componentes", "Logo.tsx")))
  .map((f) => ({ archivo: path.relative(RAIZ, f), texto: fs.readFileSync(f, "utf8") }));

const TOKENS = new Set(
  [...fs.readFileSync(path.join(RAIZ, "app", "globals.css"), "utf8").matchAll(/--color-([a-z-]+):/g)].map(
    (m) => m[1],
  ),
);

const UTILIDAD =
  "(?:bg|text|border(?:-[xytblr])?|ring(?:-offset)?|outline|divide|accent|fill|stroke|decoration|placeholder|from|via|to)";

describe("los colores salen de los tokens", () => {
  it("globals.css define los tokens", () => {
    expect(TOKENS.has("fondo")).toBe(true);
    expect(TOKENS.has("primary")).toBe(true);
  });

  it("ninguna pantalla usa la paleta de fábrica de Tailwind", () => {
    const re = new RegExp(
      `(?<![\\w-])${UTILIDAD}-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(?:-\\d{2,3})?(?![\\w-])`,
      "g",
    );
    const encontrados = FUENTES.flatMap(({ archivo, texto }) =>
      [...texto.matchAll(re)].map((m) => `${archivo}: ${m[0]}`),
    );
    expect(encontrados).toEqual([]);
  });

  it("ningún color escrito como hex en una clase", () => {
    const encontrados = FUENTES.flatMap(({ archivo, texto }) =>
      [...texto.matchAll(new RegExp(`(?<![\\w-])${UTILIDAD}-\\[#[0-9a-fA-F]{3,8}\\]`, "g"))].map(
        (m) => `${archivo}: ${m[0]}`,
      ),
    );
    expect(encontrados).toEqual([]);
  });

  it("todo token que se usa existe en globals.css", () => {
    // Las familias de la identidad. Un nombre mal escrito dentro de una de
    // ellas (`tinta-gris`, `exito-suave`) se corta acá.
    const familias =
      "primary|fondo|superficie|elevada|borde|tinta|exito|aviso|error|dato|ahora|excepcion|alerta";
    const re = new RegExp(`(?<![\\w-])${UTILIDAD}-((?:${familias})(?:-[a-z]+)*)(?:\\/\\d+)?(?![\\w-])`, "g");
    const desconocidos = FUENTES.flatMap(({ archivo, texto }) =>
      [...texto.matchAll(re)].filter((m) => !TOKENS.has(m[1])).map((m) => `${archivo}: ${m[0]}`),
    );
    expect(desconocidos).toEqual([]);
  });
});
