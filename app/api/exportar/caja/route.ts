import ExcelJS from "exceljs";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import {
  formatearFechaAR,
  mesActualAR,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
} from "@/lib/fechas";
import { armarCSV } from "@/lib/exportar/contactos";
import { acumular, enDolares, type Movimiento, type TipoMovimiento } from "@/lib/caja/saldo";

const ENCABEZADOS = [
  "Fecha",
  "Movimiento",
  "Categoria",
  "Detalle",
  "Departamento",
  "Monto",
  "Saldo",
  "Dolares",
  "Cotizacion",
  "Reembolsable",
  "Cobrado",
  "Fecha de cobro",
  "Forma de cobro",
] as const;

type Cruda = {
  id: string;
  fecha: string;
  tipo: string;
  monto: number;
  moneda: string;
  tc: number | null;
  descripcion: string | null;
  reembolsable: boolean;
  fecha_cobro: string | null;
  forma_cobro: string | null;
  categoria: { id: string; nombre: string } | null;
  depto: { id: string; codigo: string } | null;
};

/**
 * La caja de un rango de fechas, en XLSX o CSV.
 *
 * Sale con el saldo acumulado renglón por renglón, arrancando del saldo que
 * dejó todo lo anterior al rango: es la misma cuenta que muestra la pantalla,
 * para que el archivo y el sistema digan lo mismo.
 */
export async function GET(request: Request) {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCaja(supabase))) {
    return new Response("La caja es de manager y administración.", { status: 403 });
  }

  const params = new URL(request.url).searchParams;
  const mes = params.get("mes");
  const desde =
    params.get("desde") ?? primerDiaDelMes(mes ?? mesActualAR());
  const hasta =
    params.get("hasta") ??
    sumarDias(primerDiaDelMes(sumarMeses(mes ?? mesActualAR(), 1)), -1);
  const formato = params.get("formato") === "csv" ? "csv" : "xlsx";

  const [{ data: saldoInicial }, { data: crudos, error }] = await Promise.all([
    supabase.rpc("saldo_caja_antes", { p_fecha: desde }),
    supabase
      .from("movimientos_caja")
      .select(
        `id, fecha, tipo, monto, moneda, tc, descripcion, reembolsable,
         fecha_cobro, forma_cobro,
         categoria:categorias_movimiento(id, nombre),
         depto:departamentos(id, codigo)`,
      )
      .eq("activo", true)
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha")
      .order("created_at"),
  ]);

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  const movimientos: Movimiento[] = ((crudos ?? []) as unknown as Cruda[]).map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo as TipoMovimiento,
    monto: m.monto,
    moneda: m.moneda,
    tc: m.tc,
    descripcion: m.descripcion,
    categoria_id: m.categoria?.id ?? null,
    categoria_nombre: m.categoria?.nombre ?? null,
    depto_id: m.depto?.id ?? null,
    depto_codigo: m.depto?.codigo ?? null,
    reembolsable: m.reembolsable,
    fecha_cobro: m.fecha_cobro,
    forma_cobro: m.forma_cobro,
  }));

  const conSaldo = acumular(movimientos, Number(saldoInicial ?? 0));

  // Los montos van como número, no como texto: el archivo se abre para
  // sumar, filtrar y hacer tablas.
  const filas = conSaldo.map((m) => [
    formatearFechaAR(m.fecha),
    m.tipo === "ingreso" ? "INGRESO" : "EGRESO",
    m.categoria_nombre ?? "",
    m.descripcion ?? "",
    m.depto_codigo ?? "",
    m.tipo === "ingreso" ? m.monto : -m.monto,
    m.saldo,
    enDolares(m),
    m.tc,
    m.reembolsable ? "Si" : "",
    m.reembolsable ? (m.fecha_cobro ? "Si" : "No") : "",
    m.fecha_cobro ? formatearFechaAR(m.fecha_cobro) : "",
    m.forma_cobro ?? "",
  ]);

  const nombre = `caja-${desde}-a-${hasta}`;

  if (formato === "csv") {
    return new Response(
      armarCSV(
        ENCABEZADOS,
        filas.map((f) => f.map((v) => (v === null ? "" : String(v)))),
      ),
      {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${nombre}.csv"`,
        },
      },
    );
  }

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Caja");

  hoja.addRow([...ENCABEZADOS]);
  hoja.getRow(1).font = { bold: true };
  hoja.views = [{ state: "frozen", ySplit: 1 }];

  // El saldo con el que arranca el rango, para que la columna cierre sola.
  const inicial = hoja.addRow([
    formatearFechaAR(desde),
    "",
    "SALDO ANTERIOR",
    "",
    "",
    null,
    Number(saldoInicial ?? 0),
  ]);
  inicial.font = { italic: true, color: { argb: "FF5A6270" } };

  filas.forEach((f) => hoja.addRow(f));

  hoja.columns = [
    { width: 12 }, { width: 12 }, { width: 26 }, { width: 40 }, { width: 16 },
    { width: 14 }, { width: 14 }, { width: 12 }, { width: 12 },
    { width: 13 }, { width: 10 }, { width: 14 }, { width: 20 },
  ];
  for (const columna of ["F", "G"]) {
    hoja.getColumn(columna).numFmt = "#,##0;[Red]-#,##0";
  }
  hoja.getColumn("H").numFmt = "#,##0.00";
  hoja.getColumn("I").numFmt = "#,##0.00";

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nombre}.xlsx"`,
    },
  });
}
