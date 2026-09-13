import ExcelJS from "exceljs";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyAR } from "@/lib/fechas";
import {
  COLUMNAS_NUMERO,
  COLUMNAS_TEXTO,
  ENCABEZADOS_TENTATIVAS,
  filaTentativa,
  PRIMERA_A_COMPLETAR,
  type ReservaTentativa,
} from "@/lib/exportar/tentativas";

/**
 * Excel de TODAS las reservas tentativas (datos_completos = false), futuras
 * y pasadas, sin canceladas ni descartadas (lib/exportar/tentativas.ts).
 */
export async function GET() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  // La base devuelve como máximo mil filas y no avisa cuando corta.
  const reservas: ReservaTentativa[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("reservas")
      .select(
        `codigo_reserva, fecha_checkin, fecha_checkout, noches, huesped_nombre, huesped_contacto,
         adultos, ninos, bebes, payout_monto, raw,
         depto:departamentos(codigo), cambios:cambios_calendario(tipo, estado)`,
      )
      .eq("datos_completos", false)
      .eq("cancelada", false)
      .eq("descartada", false)
      .order("fecha_checkin")
      .order("codigo_reserva")
      .range(desde, desde + 999);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    reservas.push(...((data ?? []) as ReservaTentativa[]));
    if ((data ?? []).length < 1000) break;
  }

  const hoy = hoyAR();
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Tentativas");
  hoja.addRow([...ENCABEZADOS_TENTATIVAS]);
  hoja.getRow(1).font = { bold: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  for (const reserva of reservas) {
    const fila = hoja.addRow(filaTentativa(reserva, hoy));
    // Código, últimos 4 y teléfono van como TEXTO: como número, "0137"
    // pierde el cero y un teléfono largo se vuelve notación científica.
    for (const columna of COLUMNAS_TEXTO) {
      const celda = fila.getCell(columna);
      celda.numFmt = "@";
      celda.value = String(celda.value ?? "");
    }
    // Noches, huéspedes y payout, en cambio, como número: como texto Excel
    // no los suma y los marca como error.
    for (const columna of COLUMNAS_NUMERO) {
      const celda = fila.getCell(columna);
      celda.value = celda.value === "" ? null : Number(celda.value);
    }
    const link = fila.getCell(2);
    link.value = { text: "Abrir en Airbnb", hyperlink: String(link.value) };
    link.font = { underline: true, color: { argb: "FF1A5FB4" } };
  }

  for (const columna of COLUMNAS_TEXTO) hoja.getColumn(columna).numFmt = "@";

  // Lo que hay que completar, con el encabezado resaltado.
  for (let c = PRIMERA_A_COMPLETAR; c <= ENCABEZADOS_TENTATIVAS.length; c++) {
    hoja.getRow(1).getCell(c).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFBF0D9" },
    };
  }

  hoja.columns = [
    { width: 14 }, { width: 16 }, { width: 20 }, { width: 12 }, { width: 12 },
    { width: 8 }, { width: 10 }, { width: 12 }, { width: 18 },
    { width: 26 }, { width: 18 }, { width: 9 }, { width: 8 }, { width: 8 }, { width: 13 },
  ];
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: ENCABEZADOS_TENTATIVAS.length } };

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="reservas-tentativas-${hoy}.xlsx"`,
    },
  });
}
