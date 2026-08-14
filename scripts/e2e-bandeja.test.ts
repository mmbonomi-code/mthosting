/**
 * Prueba de punta a punta de la bandeja contra la base DEV.
 *
 * Simula el caso real: un anuncio deja de estar mapeado (Airbnb lo renombró),
 * se importa, las reservas caen en la bandeja, se mapean UNA vez y las
 * importaciones siguientes lo resuelven solas.
 *
 * Se corre a mano: npx vitest run scripts/e2e-bandeja.test.ts
 */
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { ejecutarImportacion } from "../lib/importador/ejecutar";
import { mapearAnuncio } from "../lib/importador/bandeja";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Anuncio real presente en el export del 02/08.
const ANUNCIO = "Tranquilo y familiar en recoleta";
const ARCHIVO = "reservations - 2026-08-02T084540.299.csv";

// Se crea recién dentro del describe: sin credenciales el archivo se saltea
// entero en vez de romper al cargarse.
describe.skipIf(!url || !clave)("bandeja de reservas sin asignar (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  let deptoOriginal: string | null = null;

  afterAll(async () => {
    // Deja todo como estaba, pase lo que pase.
    if (deptoOriginal) {
      await s
        .from("listing_alias")
        .update({ activo: true, depto_id: deptoOriginal })
        .eq("nombre_listing", ANUNCIO);
      await s
        .from("reservas")
        .update({ depto_id: deptoOriginal })
        .eq("listing_nombre_raw", ANUNCIO);
    }
  });

  it("anuncio nuevo cae en la bandeja, se mapea una vez y no vuelve a preguntar", async () => {
    // --- Preparación: el anuncio "deja de existir" para el importador ---
    const { data: alias } = await s
      .from("listing_alias")
      .select("depto_id")
      .eq("nombre_listing", ANUNCIO)
      .single();
    deptoOriginal = alias!.depto_id;

    await s.from("listing_alias").update({ activo: false }).eq("nombre_listing", ANUNCIO);
    await s
      .from("reservas")
      .update({ depto_id: null })
      .eq("listing_nombre_raw", ANUNCIO);

    // --- 1. Importar: las reservas de ese anuncio quedan sin departamento ---
    const contenido = [
      { nombre: ARCHIVO, contenido: readFileSync(`C:/Users/negro/Downloads/${ARCHIVO}`, "utf8") },
    ];
    const primera = await ejecutarImportacion(s, contenido, null);
    expect(primera.sin_asignar).toBeGreaterThan(0);
    console.log(`importación: ${primera.sin_asignar} reservas sin departamento`);

    // Aparecen en la bandeja (misma consulta que la pantalla).
    const { data: enBandeja } = await s
      .from("reservas")
      .select("id, listing_nombre_raw, cancelada")
      .is("depto_id", null)
      .eq("descartada", false);
    const delAnuncio = (enBandeja ?? []).filter((r) => r.listing_nombre_raw === ANUNCIO);
    expect(delAnuncio.length).toBeGreaterThan(0);
    console.log(`bandeja: ${delAnuncio.length} reservas de "${ANUNCIO}"`);

    // --- 2. Mapear UNA vez ---
    const { reservasAsignadas, limpiezasGeneradas } = await mapearAnuncio(
      s,
      ANUNCIO,
      deptoOriginal!,
    );
    expect(reservasAsignadas).toBe(delAnuncio.length);
    console.log(
      `mapeo: ${reservasAsignadas} reservas asignadas, ${limpiezasGeneradas} limpiezas generadas`,
    );


    // La bandeja queda limpia para ese anuncio.
    const { count: quedan } = await s
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .is("depto_id", null)
      .eq("listing_nombre_raw", ANUNCIO);
    expect(quedan).toBe(0);

    // El alias quedó activo y apuntando al departamento correcto.
    const { data: aliasFinal } = await s
      .from("listing_alias")
      .select("activo, depto_id")
      .eq("nombre_listing", ANUNCIO)
      .single();
    expect(aliasFinal).toMatchObject({ activo: true, depto_id: deptoOriginal });

    // --- 3. Importar de nuevo: ya no pregunta más ---
    const segunda = await ejecutarImportacion(s, contenido, null);
    const { count: sinAsignarDelAnuncio } = await s
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .is("depto_id", null)
      .eq("listing_nombre_raw", ANUNCIO);
    expect(sinAsignarDelAnuncio).toBe(0);
    console.log(
      `re-importación: ${segunda.sin_asignar} sin asignar en total, 0 de este anuncio`,
    );
  }, 180000);

  /**
   * El caso que reportó el dueño con ARENALES 9 (13/08/2026): la reserva
   * quedaba con su departamento puesto pero SIN eventos, y una reserva sin
   * eventos no aparece en la pantalla del día. El check-in existía y era
   * invisible.
   *
   * Esta prueba se arma su propia reserva, con un anuncio que no existe en
   * ningún lado, y borra todo lo suyo al terminar. No toca ni un dato de la
   * operación: la lección de la prueba del calendario, que se llevó puestas
   * 12 limpiezas reales por borrar por código.
   */
  describe("una reserva recién mapeada queda lista para trabajar", () => {
    const ANUNCIO_INVENTADO = `ZZ prueba bandeja ${Date.now()}`;
    const CODIGO = `HMZZB${String(Date.now()).slice(-5)}`;
    let reservaId: string | null = null;
    let deptoId: string | null = null;

    afterAll(async () => {
      if (reservaId) {
        await s.from("limpiezas").delete().eq("reserva_id", reservaId);
        await s.from("eventos_estadia").delete().eq("reserva_id", reservaId);
        await s.from("reservas").delete().eq("id", reservaId);
      }
      await s.from("listing_alias").delete().eq("nombre_listing", ANUNCIO_INVENTADO);
    });

    it("le genera los eventos y la limpieza al asignarle el departamento", async () => {
      const { data: depto } = await s
        .from("departamentos")
        .select("id")
        .eq("estado", "activo")
        .limit(1)
        .single();
      deptoId = depto!.id;

      // Una reserva como la deja la importación cuando el anuncio no se
      // reconoce: con fechas y sin departamento.
      const { data: creada, error } = await s
        .from("reservas")
        .insert({
          codigo_reserva: CODIGO,
          canal: "airbnb",
          origen: "csv",
          depto_id: null,
          listing_nombre_raw: ANUNCIO_INVENTADO,
          fecha_checkin: "2027-06-10",
          fecha_checkout: "2027-06-14",
          noches: 4,
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      reservaId = creada!.id;

      // Sin departamento no tiene nada, y así es como estaba el check-in que
      // no aparecía.
      const { count: antes } = await s
        .from("eventos_estadia")
        .select("id", { count: "exact", head: true })
        .eq("reserva_id", reservaId);
      expect(antes).toBe(0);

      const { reservasAsignadas, limpiezasGeneradas } = await mapearAnuncio(
        s,
        ANUNCIO_INVENTADO,
        deptoId!,
      );
      expect(reservasAsignadas).toBe(1);
      expect(limpiezasGeneradas).toBeGreaterThan(0);

      // Ahora sí: los dos eventos, que es lo que la hace visible en el día.
      const { data: eventos } = await s
        .from("eventos_estadia")
        .select("tipo")
        .eq("reserva_id", reservaId);
      expect((eventos ?? []).map((e) => e.tipo).sort()).toEqual(["checkin", "checkout"]);

      // Y su limpieza de salida, el día del check-out.
      const { data: limpiezas } = await s
        .from("limpiezas")
        .select("fecha, rol_reserva, depto_id")
        .eq("reserva_id", reservaId)
        .neq("estado", "cancelada");
      expect(limpiezas).toContainEqual({
        fecha: "2027-06-14",
        rol_reserva: "salida",
        depto_id: deptoId,
      });
      console.log(
        `reserva mapeada: ${(eventos ?? []).length} eventos y ${(limpiezas ?? []).length} limpiezas`,
      );
    }, 120000);
  });
});
