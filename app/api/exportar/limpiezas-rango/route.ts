import ExcelJS from "exceljs";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR, sumarDias } from "@/lib/fechas";
import { TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import { armarCSV } from "@/lib/exportar/contactos";

const ENCABEZADOS = ["Departamento", "Fecha", "Tipo", "Responsable"] as const;

/**
 * Limpiezas por rango de fecha de limpieza (spec §3.5.0), en XLSX o CSV.
 * Incluye las que no tienen responsable: van marcadas.
 */
export async function GET(request: Request) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const params = new URL(request.url).searchParams;
  const desde = params.get("desde") ?? hoyAR();
  const hasta = params.get("hasta") ?? sumarDias(desde, 6);
  const formato = params.get("formato") === "csv" ? "csv" : "xlsx";

  const { data: limpiezas, error } = await supabase
    .from("limpiezas")
    .select("fecha, tipo, depto:departamentos(codigo), responsable:personas(nombre)")
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .neq("estado", "cancelada")
    .order("fecha");

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  const filas = (limpiezas ?? []).map((l) => [
    l.depto?.codigo ?? "",
    formatearFechaAR(l.fecha),
    TIPOS_LIMPIEZA[l.tipo] ?? l.tipo,
    l.responsable?.nombre ?? "SIN ASIGNAR",
  ]);

  const nombre = `limpiezas-${desde}-a-${hasta}`;

  if (formato === "csv") {
    return new Response(armarCSV(ENCABEZADOS, filas), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${nombre}.csv"`,
      },
    });
  }

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Limpiezas");
  hoja.addRow([...ENCABEZADOS]);
  hoja.getRow(1).font = { bold: true };
  filas.forEach((f) => hoja.addRow(f));
  hoja.columns = [{ width: 18 }, { width: 14 }, { width: 20 }, { width: 24 }];

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
    },
  });
}
