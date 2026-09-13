import ExcelJS from "exceljs";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyAR } from "@/lib/fechas";
import {
  COLUMNA_ESTADO,
  COLUMNAS_NUMERO,
  COLUMNAS_TEXTO,
  ENCABEZADOS_TENTATIVAS,
  ESTADOS_AIRBNB,
  filaTentativa,
  PRIMERA_A_COMPLETAR,
  type ReservaTentativa,
} from "@/lib/exportar/tentativas";

const CAMPOS = `codigo_reserva, fecha_checkin, fecha_checkout, noches, huesped_nombre, huesped_contacto,
  adultos, ninos, bebes, raw, depto:departamentos(codigo), cambios:cambios_calendario(tipo, estado)`;

/**
 * Excel de tentativas y posibles cancelaciones, sin canceladas ni
 * descartadas (lib/exportar/tentativas.ts). Se completa y se sube desde
 * /importar.
 */
export async function GET() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  // Las posibles cancelaciones pendientes, aunque ya tengan sus datos.
  const { data: marcas, error: errorMarcas } = await supabase
    .from("cambios_calendario")
    .select("reserva_id")
    .eq("tipo", "posible_cancelacion")
    .eq("estado", "pendiente");
  if (errorMarcas) return new Response(`Error: ${errorMarcas.message}`, { status: 500 });
  const idsMarcadas = [...new Set((marcas ?? []).map((m) => m.reserva_id))];

  const porCodigo = new Map<string, ReservaTentativa>();

  // La base devuelve como máximo mil filas y no avisa cuando corta.
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await supabase
      .from("reservas")
      .select(CAMPOS)
      .eq("datos_completos", false)
      .eq("cancelada", false)
      .eq("descartada", false)
      .order("codigo_reserva")
      .range(desde, desde + 999);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    for (const r of (data ?? []) as ReservaTentativa[]) porCodigo.set(r.codigo_reserva, r);
    if ((data ?? []).length < 1000) break;
  }

  for (let i = 0; i < idsMarcadas.length; i += 200) {
    const { data, error } = await supabase
      .from("reservas")
      .select(CAMPOS)
      .in("id", idsMarcadas.slice(i, i + 200))
      .eq("cancelada", false)
      .eq("descartada", false);
    if (error) return new Response(`Error: ${error.message}`, { status: 500 });
    for (const r of (data ?? []) as ReservaTentativa[]) porCodigo.set(r.codigo_reserva, r);
  }

  const reservas = [...porCodigo.values()].sort(
    (a, b) =>
      (a.fecha_checkin ?? "").localeCompare(b.fecha_checkin ?? "") ||
      a.codigo_reserva.localeCompare(b.codigo_reserva),
  );

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
    // Noches y huéspedes, en cambio, como número: como texto Excel los
    // marca como error.
    for (const columna of COLUMNAS_NUMERO) {
      const celda = fila.getCell(columna);
      celda.value = celda.value === "" ? null : Number(celda.value);
    }
    const link = fila.getCell(2);
    link.value = { text: "Abrir en Airbnb", hyperlink: String(link.value) };
    link.font = { underline: true, color: { argb: "FF1A5FB4" } };

    const estado = fila.getCell(COLUMNA_ESTADO);
    estado.value = null;
    estado.dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [`"${ESTADOS_AIRBNB.join(",")}"`],
      showErrorMessage: true,
      errorTitle: "Estado en Airbnb",
      error: `Elegí ${ESTADOS_AIRBNB.join(" o ")}, o dejalo vacío.`,
    };
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
    { width: 16 }, { width: 26 }, { width: 20 }, { width: 9 }, { width: 8 }, { width: 8 },
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
