import ExcelJS from "exceljs";
import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyAR, sumarDias } from "@/lib/fechas";
import {
  armarCSV,
  ENCABEZADOS_COMUNICACION,
  ENCABEZADOS_GOOGLE,
  filaComunicacion,
  filaGoogle,
  type ReservaContacto,
} from "@/lib/exportar/contactos";

/**
 * Exportables de contactos de huéspedes (spec §3.5), con el mismo filtro:
 * rango sobre la FECHA DE CHECK-IN. Se excluyen las canceladas (Airbnb les
 * borra el teléfono) y las que todavía no tienen departamento.
 *
 *   ?destino=comunicacion → XLSX del sistema de comunicación
 *   ?destino=google       → CSV de Google Contacts
 */
export async function GET(request: Request) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const params = new URL(request.url).searchParams;
  const desde = params.get("desde") ?? hoyAR();
  const hasta = params.get("hasta") ?? sumarDias(desde, 30);
  const destino = params.get("destino") === "google" ? "google" : "comunicacion";

  const { data: reservas, error } = await supabase
    .from("reservas")
    .select(
      "codigo_reserva, huesped_nombre, huesped_contacto, fecha_checkin, fecha_checkout, depto:departamentos(nombre_interno)",
    )
    .gte("fecha_checkin", desde)
    .lte("fecha_checkin", hasta)
    .eq("cancelada", false)
    .eq("descartada", false)
    .not("depto_id", "is", null)
    .order("fecha_checkin");

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  const lista = (reservas ?? []) as ReservaContacto[];

  if (destino === "google") {
    const csv = armarCSV(ENCABEZADOS_GOOGLE, lista.map(filaGoogle));
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contactos-google-${desde}-a-${hasta}.csv"`,
      },
    });
  }

  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Contactos");
  hoja.addRow([...ENCABEZADOS_COMUNICACION]);
  hoja.getRow(1).font = { bold: true };

  for (const reserva of lista) {
    const fila = hoja.addRow(filaComunicacion(reserva));
    // El celular va como TEXTO: guardado como número se convierte en
    // notación científica y el archivo llega roto al destino.
    const celda = fila.getCell(2);
    celda.numFmt = "@";
    celda.value = String(celda.value ?? "");
  }

  hoja.getColumn(2).numFmt = "@";
  hoja.columns = [
    { width: 28 }, { width: 18 }, { width: 10 }, { width: 10 }, { width: 8 },
    { width: 14 }, { width: 6 }, { width: 20 }, { width: 8 }, { width: 8 },
    { width: 8 }, { width: 10 }, { width: 12 }, { width: 12 },
  ];

  const buffer = await libro.xlsx.writeBuffer();
  return new Response(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="contactos-${desde}-a-${hasta}.xlsx"`,
    },
  });
}
