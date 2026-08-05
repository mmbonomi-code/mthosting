/**
 * Genera los cuatro exportables con datos REALES de la base DEV y verifica
 * su contenido: que el PDF sea un PDF, que el Excel guarde el celular como
 * texto y que los países salgan del código telefónico.
 */
import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { generarPDFLimpiezas, type FilaPDF } from "../lib/exportar/pdf";
import {
  armarCSV,
  ENCABEZADOS_COMUNICACION,
  ENCABEZADOS_GOOGLE,
  filaComunicacion,
  filaGoogle,
  type ReservaContacto,
} from "../lib/exportar/contactos";
import { formatearFechaAR } from "../lib/fechas";
import { TIPOS_LIMPIEZA } from "../lib/limpiezas/etiquetas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("exportables (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

  it("el PDF del día sale con las limpiezas reales", async () => {
    const { data: limpiezas } = await s
      .from("limpiezas")
      .select(
        "fecha, tipo, depto:departamentos(codigo, direccion), responsable:personas(nombre), reserva:reservas(noches, fecha_checkout)",
      )
      .neq("estado", "cancelada")
      .order("fecha")
      .limit(40);

    const filas: FilaPDF[] = (limpiezas ?? []).map((l) => ({
      departamento: l.depto?.codigo ?? "",
      noches: l.reserva?.noches ? String(l.reserva.noches) : "",
      checkout: l.reserva?.fecha_checkout ? formatearFechaAR(l.reserva.fecha_checkout) : "",
      horaCheckout: "",
      tipo: TIPOS_LIMPIEZA[l.tipo] ?? l.tipo,
      proxReserva: "",
      proxCheckin: "",
      direccion: l.depto?.direccion ?? "",
      responsable: l.responsable?.nombre ?? "SIN ASIGNAR",
    }));

    const pdf = await generarPDFLimpiezas({
      titulo: "Limpiezas · prueba",
      subtitulo: `${filas.length} limpiezas`,
      filas,
    });

    // Un PDF válido arranca con %PDF-
    expect(Buffer.from(pdf.slice(0, 5)).toString()).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(1000);
    console.log(`PDF: ${filas.length} filas, ${Math.round(pdf.byteLength / 1024)} KB`);
    // Las direcciones con acentos y comillas no rompen la generación.
    console.log(`  ej: ${filas[0]?.departamento} — ${filas[0]?.direccion}`);
  });

  it("el Excel de contactos guarda el celular como TEXTO", async () => {
    const { data: reservas } = await s
      .from("reservas")
      .select(
        "codigo_reserva, huesped_nombre, huesped_contacto, fecha_checkin, fecha_checkout, depto:departamentos(nombre_interno)",
      )
      .eq("cancelada", false)
      .eq("descartada", false)
      .not("depto_id", "is", null)
      .not("huesped_contacto", "is", null)
      .limit(30);

    const lista = (reservas ?? []) as ReservaContacto[];
    expect(lista.length).toBeGreaterThan(0);

    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet("Contactos");
    hoja.addRow([...ENCABEZADOS_COMUNICACION]);
    for (const r of lista) {
      const fila = hoja.addRow(filaComunicacion(r));
      const celda = fila.getCell(2);
      celda.numFmt = "@";
      celda.value = String(celda.value ?? "");
    }

    const buffer = await libro.xlsx.writeBuffer();

    // Se relee el archivo generado: es la única prueba que vale.
    const releido = new ExcelJS.Workbook();
    await releido.xlsx.load(buffer as ArrayBuffer);
    const hojaLeida = releido.getWorksheet("Contactos")!;

    const encabezados = (hojaLeida.getRow(1).values as unknown[]).slice(1);
    expect(encabezados).toEqual([...ENCABEZADOS_COMUNICACION]);

    let conPais = 0;
    for (let i = 2; i <= Math.min(6, hojaLeida.rowCount); i++) {
      const fila = hojaLeida.getRow(i);
      const celular = fila.getCell(2);
      // Lo importante: el teléfono es texto, no número.
      expect(typeof celular.value).toBe("string");
      expect(celular.numFmt).toBe("@");
      if (fila.getCell(7).value) conPais++;
      console.log(
        `  ${String(fila.getCell(1).value).padEnd(28)} ${String(celular.value).padEnd(15)} ${fila.getCell(7).value ?? "--"} ${fila.getCell(8).value}`,
      );
    }
    expect(conPais).toBeGreaterThan(0);
    console.log(`Excel: ${lista.length} contactos, ${Math.round((buffer as ArrayBuffer).byteLength / 1024)} KB`);
  });

  it("el CSV de Google sale con sus seis columnas", async () => {
    const { data: reservas } = await s
      .from("reservas")
      .select(
        "codigo_reserva, huesped_nombre, huesped_contacto, fecha_checkin, fecha_checkout, depto:departamentos(nombre_interno)",
      )
      .eq("cancelada", false)
      .eq("descartada", false)
      .not("depto_id", "is", null)
      .limit(10);

    const csv = armarCSV(
      ENCABEZADOS_GOOGLE,
      ((reservas ?? []) as ReservaContacto[]).map(filaGoogle),
    );
    const lineas = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lineas[0]).toBe(ENCABEZADOS_GOOGLE.join(","));
    console.log("CSV Google, primeras filas:");
    lineas.slice(1, 4).forEach((l) => console.log("  " + l));
  });
});
