/**
 * PDF de las limpiezas de un día (spec §3.4). Tabla simple, sin diseño
 * elaborado: se imprime o se manda por WhatsApp tal cual.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

export type FilaPDF = {
  departamento: string;
  noches: string;
  checkout: string;
  horaCheckout: string;
  tipo: string;
  proxReserva: string;
  proxCheckin: string;
  direccion: string;
  responsable: string;
};

const COLUMNAS: { titulo: string; campo: keyof FilaPDF; ancho: number }[] = [
  { titulo: "Depto", campo: "departamento", ancho: 74 },
  { titulo: "Noch.", campo: "noches", ancho: 30 },
  { titulo: "Check-out", campo: "checkout", ancho: 56 },
  { titulo: "Hora", campo: "horaCheckout", ancho: 34 },
  { titulo: "Tipo", campo: "tipo", ancho: 62 },
  { titulo: "Próx. reserva", campo: "proxReserva", ancho: 62 },
  { titulo: "Próx. check-in", campo: "proxCheckin", ancho: 62 },
  { titulo: "Dirección", campo: "direccion", ancho: 176 },
  { titulo: "Responsable", campo: "responsable", ancho: 86 },
];

/**
 * Las fuentes estándar del PDF no manejan todo Unicode: se reemplaza lo que
 * no entra (comillas curvas, guiones largos) en vez de romper la descarga.
 */
function sanear(texto: string): string {
  return texto
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/ /g, " ")
    .replace(/[^\u0000-\u00FF]/g, "");
}

/** Recorta el texto para que entre en el ancho de su columna. */
function recortar(texto: string, fuente: PDFFont, tamano: number, ancho: number): string {
  let recortado = sanear(texto);
  if (fuente.widthOfTextAtSize(recortado, tamano) <= ancho) return recortado;
  while (
    recortado.length > 1 &&
    fuente.widthOfTextAtSize(recortado + "…", tamano) > ancho
  ) {
    recortado = recortado.slice(0, -1);
  }
  return recortado + ".";
}

export async function generarPDFLimpiezas({
  titulo,
  subtitulo,
  filas,
}: {
  titulo: string;
  subtitulo: string;
  filas: FilaPDF[];
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);

  const ANCHO = 842; // A4 apaisado
  const ALTO = 595;
  const MARGEN = 24;
  const ALTO_FILA = 20;

  let pagina = pdf.addPage([ANCHO, ALTO]);
  let y = ALTO - MARGEN;

  const dibujarEncabezado = () => {
    pagina.drawText(sanear(titulo), {
      x: MARGEN,
      y: y - 14,
      size: 15,
      font: negrita,
    });
    pagina.drawText(sanear(subtitulo), {
      x: MARGEN,
      y: y - 30,
      size: 9,
      font: normal,
      color: rgb(0.4, 0.4, 0.4),
    });
    y -= 48;

    let x = MARGEN;
    for (const col of COLUMNAS) {
      pagina.drawText(col.titulo, { x, y, size: 8, font: negrita });
      x += col.ancho;
    }
    y -= 6;
    pagina.drawLine({
      start: { x: MARGEN, y },
      end: { x: ANCHO - MARGEN, y },
      thickness: 0.7,
      color: rgb(0.6, 0.6, 0.6),
    });
    y -= ALTO_FILA - 6;
  };

  dibujarEncabezado();

  for (const [indice, fila] of filas.entries()) {
    if (y < MARGEN + ALTO_FILA) {
      pagina = pdf.addPage([ANCHO, ALTO]);
      y = ALTO - MARGEN;
      dibujarEncabezado();
    }

    // Fondo alternado: ayuda a seguir la fila con el dedo en el papel.
    if (indice % 2 === 1) {
      pagina.drawRectangle({
        x: MARGEN - 4,
        y: y - 5,
        width: ANCHO - MARGEN * 2 + 8,
        height: ALTO_FILA - 4,
        color: rgb(0.95, 0.95, 0.96),
      });
    }

    let x = MARGEN;
    for (const col of COLUMNAS) {
      const valor = fila[col.campo] ?? "";
      pagina.drawText(recortar(valor, normal, 8.5, col.ancho - 6), {
        x,
        y,
        size: 8.5,
        font: col.campo === "departamento" ? negrita : normal,
      });
      x += col.ancho;
    }
    y -= ALTO_FILA;
  }

  if (filas.length === 0) {
    pagina.drawText("No hay limpiezas para esta fecha.", {
      x: MARGEN,
      y,
      size: 10,
      font: normal,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  return pdf.save();
}
