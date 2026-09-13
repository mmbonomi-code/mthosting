/**
 * Leer una hoja de Excel como texto, celda por celda.
 *
 * Una celda de Excel no es siempre texto: puede ser un número (un teléfono
 * que Excel convirtió), un link, texto con formato o una fórmula. Las reglas
 * del importador trabajan sobre texto, así que la traducción se hace una vez
 * y acá.
 */

import ExcelJS from "exceljs";

type ValorCelda = ExcelJS.CellValue;

export function celdaATexto(valor: ValorCelda): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "string") return valor;
  if (typeof valor === "number") {
    // Un teléfono que Excel guardó como número: sin notación científica.
    return Number.isInteger(valor) ? BigInt(valor).toString() : String(valor);
  }
  if (typeof valor === "boolean") return valor ? "VERDADERO" : "FALSO";
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  if (typeof valor === "object") {
    if ("richText" in valor) return valor.richText.map((t) => t.text).join("");
    if ("hyperlink" in valor) return celdaATexto(valor.text as ValorCelda);
    if ("formula" in valor || "sharedFormula" in valor) {
      return celdaATexto((valor as { result?: ValorCelda }).result ?? null);
    }
    if ("error" in valor) return "";
  }
  return String(valor);
}

/** La primera hoja del libro, como filas de texto. */
export async function leerHojaXlsx(bytes: ArrayBuffer): Promise<string[][]> {
  const libro = new ExcelJS.Workbook();
  try {
    await libro.xlsx.load(bytes);
  } catch {
    throw new Error("El archivo no es un Excel (.xlsx) válido.");
  }
  const hoja = libro.worksheets[0];
  if (!hoja) return [];

  const filas: string[][] = [];
  hoja.eachRow({ includeEmpty: true }, (fila, numero) => {
    const valores: string[] = [];
    for (let c = 1; c <= hoja.columnCount; c++) valores.push(celdaATexto(fila.getCell(c).value));
    filas[numero - 1] = valores;
  });
  // eachRow con includeEmpty no rellena huecos antes de la primera fila.
  return Array.from(filas, (f) => f ?? []);
}
