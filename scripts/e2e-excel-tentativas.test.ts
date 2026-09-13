/**
 * Prueba de punta a punta del Excel de tentativas, ida y vuelta, contra la
 * base DEV: se descarga con la ruta real, se completa y se sube.
 *
 * Trabaja con CUATRO reservas inventadas de 2030. Las filas de las reservas
 * reales que trae el Excel quedan vacías, y una fila vacía no toca nada. Al
 * terminar borra SOLO lo que creó (ver el aviso de scripts/e2e-ical.test.ts).
 */
import ExcelJS from "exceljs";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { generarLimpiezas } from "../lib/limpiezas/generar";
import { ENCABEZADOS_TENTATIVAS } from "../lib/exportar/tentativas";
import { ejecutarExcelTentativas } from "../lib/importador/ejecutarTentativas";
import { leerHojaXlsx } from "../lib/importador/xlsx";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

// La ruta de exportación usa el cliente de la sesión: acá, el de servidor.
vi.mock("@/lib/supabase/server", () => ({
  crearClienteServidor: async () => {
    const s = createClient(url!, clave!, { auth: { persistSession: false } });
    (s.auth as unknown as { getUser: unknown }).getUser = async () => ({ data: { user: { id: "prueba" } } });
    return s;
  },
}));

const DATOS = "HMPRUEBAEX1"; // tentativa sin marca: se le completan datos
const CANCELA = "HMPRUEBAEX2"; // marcada por el calendario: "Cancelada" la cancela
const A_ALERTAS = "HMPRUEBAEX3"; // sin marca: "Cancelada" la manda a Alertas
const SIGUE = "HMPRUEBAEX4"; // marcada por el calendario: "Confirmada" = sigue en pie
const CODIGOS = [DATOS, CANCELA, A_ALERTAS, SIGUE];
const NOMBRE_ARCHIVO = "prueba-e2e-tentativas.xlsx";

describe.skipIf(!url || !clave)("Excel de tentativas, ida y vuelta (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const ids = new Map<string, string>();

  afterAll(async () => {
    const todos = [...ids.values()];
    if (todos.length > 0) {
      for (const tabla of ["cambios_calendario", "limpiezas", "eventos_estadia"] as const) {
        const { error } = await s.from(tabla).delete().in("reserva_id", todos);
        expect(error, `no se pudieron borrar ${tabla} de la prueba`).toBeNull();
      }
      const { error } = await s.from("reservas").delete().in("id", todos);
      expect(error, "no se pudieron borrar las reservas de la prueba").toBeNull();
    }
    // Las importaciones que registró la prueba, identificadas por su archivo.
    const { data: registros } = await s
      .from("importaciones")
      .select("id, archivos")
      .eq("tipo", "excel_tentativas");
    const deLaPrueba = (registros ?? [])
      .filter((r) => JSON.stringify(r.archivos).includes(NOMBRE_ARCHIVO))
      .map((r) => r.id);
    if (deLaPrueba.length > 0) await s.from("importaciones").delete().in("id", deLaPrueba);
  });

  it("completa datos, cancela, manda a Alertas y deja en pie según el Excel", async () => {
    const { data: previas } = await s.from("reservas").select("id").in("codigo_reserva", CODIGOS);
    expect(previas, "ya existen reservas de prueba: quedó sucia una corrida anterior").toEqual([]);

    const { data: depto } = await s.from("departamentos").select("id").eq("activo", true).limit(1).single();

    let dia = 10;
    for (const codigo of CODIGOS) {
      const { data, error } = await s
        .from("reservas")
        .insert({
          codigo_reserva: codigo,
          canal: "airbnb",
          origen: "ical",
          datos_completos: false,
          depto_id: depto!.id,
          fecha_checkin: `2030-06-${dia}`,
          fecha_checkout: `2030-06-${dia + 2}`,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      ids.set(codigo, data!.id);
      dia += 4;
    }
    await generarLimpiezas(s, CODIGOS, "2030-01-01");

    for (const codigo of [CANCELA, SIGUE]) {
      await s.from("cambios_calendario").insert({
        reserva_id: ids.get(codigo)!,
        tipo: "posible_cancelacion",
        firma: `prueba|${codigo}`,
      });
    }

    // --- Ida: el Excel real ---
    const { GET } = await import("../app/api/exportar/tentativas/route");
    const respuesta = await GET();
    expect(respuesta.status).toBe(200);
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(await respuesta.arrayBuffer());
    const hoja = libro.worksheets[0];

    const columna = (nombre: (typeof ENCABEZADOS_TENTATIVAS)[number]) =>
      ENCABEZADOS_TENTATIVAS.indexOf(nombre) + 1;
    const filaDe = new Map<string, ExcelJS.Row>();
    hoja.eachRow((fila, n) => {
      if (n > 1) filaDe.set(String(fila.getCell(1).value), fila);
    });
    for (const codigo of CODIGOS) expect(filaDe.has(codigo), `${codigo} no vino en el Excel`).toBe(true);

    // --- Se completa, como lo haría una persona ---
    const completar = (codigo: string, valores: Partial<Record<(typeof ENCABEZADOS_TENTATIVAS)[number], string | number>>) => {
      for (const [nombre, valor] of Object.entries(valores)) {
        filaDe.get(codigo)!.getCell(columna(nombre as (typeof ENCABEZADOS_TENTATIVAS)[number])).value = valor;
      }
    };
    // Excel convierte el teléfono en número si nadie lo impide.
    completar(DATOS, { "Nombre del huésped": "Huésped de Prueba", Teléfono: 5491155551234, Adultos: 2, Niños: 1 });
    completar(CANCELA, { "Estado en Airbnb": "Cancelada", "Nombre del huésped": "Recortado" });
    completar(A_ALERTAS, { "Estado en Airbnb": "Cancelada" });
    completar(SIGUE, { "Estado en Airbnb": "Confirmada" });
    const completado = (await libro.xlsx.writeBuffer()) as ArrayBuffer;

    // --- Vuelta ---
    const subir = async () =>
      ejecutarExcelTentativas(
        s,
        { nombre: NOMBRE_ARCHIVO, filas: await leerHojaXlsx(completado), bytes: completado },
        { id: null, personaId: null },
      );
    const resumen = await subir();
    console.log("resumen:", { ...resumen, avisos: resumen.avisos.length });

    expect(resumen).toMatchObject({
      datosActualizados: 1,
      dejaronDeSerTentativas: 1,
      canceladas: 1,
      aConfirmarEnAlertas: 1,
      siguenEnPie: 1,
    });

    const { data: reservas } = await s
      .from("reservas")
      .select("codigo_reserva, cancelada, datos_completos, huesped_nombre, huesped_contacto, adultos, ninos")
      .in("codigo_reserva", CODIGOS);
    const por = new Map((reservas ?? []).map((r) => [r.codigo_reserva, r]));

    expect(por.get(DATOS)).toMatchObject({
      datos_completos: true,
      huesped_nombre: "Huésped de Prueba",
      huesped_contacto: "+5491155551234",
      adultos: 2,
      ninos: 1,
      cancelada: false,
    });
    // Cancelada, y sin tomarle el nombre recortado.
    expect(por.get(CANCELA)).toMatchObject({ cancelada: true, huesped_nombre: null });
    expect(por.get(A_ALERTAS)).toMatchObject({ cancelada: false });
    expect(por.get(SIGUE)).toMatchObject({ cancelada: false });

    const { data: limpiezaCancelada } = await s
      .from("limpiezas")
      .select("estado")
      .eq("reserva_id", ids.get(CANCELA)!)
      .eq("rol_reserva", "salida")
      .single();
    expect(limpiezaCancelada!.estado).toBe("cancelada");

    const { data: marcas } = await s
      .from("cambios_calendario")
      .select("reserva_id, estado, origen")
      .in("reserva_id", [...ids.values()]);
    const marcaDe = (codigo: string) => (marcas ?? []).filter((m) => m.reserva_id === ids.get(codigo));
    expect(marcaDe(CANCELA)).toEqual([{ reserva_id: ids.get(CANCELA), estado: "confirmado", origen: "calendario" }]);
    expect(marcaDe(A_ALERTAS)).toEqual([{ reserva_id: ids.get(A_ALERTAS), estado: "pendiente", origen: "excel" }]);
    expect(marcaDe(SIGUE)).toEqual([{ reserva_id: ids.get(SIGUE), estado: "descartado", origen: "calendario" }]);

    // --- Subir el mismo archivo otra vez no cambia nada ---
    const otra = await subir();
    expect(otra).toMatchObject({
      datosActualizados: 0,
      canceladas: 0,
      aConfirmarEnAlertas: 0,
      siguenEnPie: 0,
    });
    const { count } = await s
      .from("cambios_calendario")
      .select("id", { count: "exact", head: true })
      .eq("reserva_id", ids.get(A_ALERTAS)!);
    expect(count).toBe(1);
  }, 300000);
});
