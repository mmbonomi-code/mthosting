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

const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

describe.skipIf(!url || !clave)("bandeja de reservas sin asignar (base dev)", () => {
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
      .select("id, listing_nombre_raw")
      .is("depto_id", null)
      .eq("descartada", false);
    const delAnuncio = (enBandeja ?? []).filter((r) => r.listing_nombre_raw === ANUNCIO);
    expect(delAnuncio.length).toBeGreaterThan(0);
    console.log(`bandeja: ${delAnuncio.length} reservas de "${ANUNCIO}"`);

    // --- 2. Mapear UNA vez ---
    const { reservasAsignadas } = await mapearAnuncio(s, ANUNCIO, deptoOriginal!);
    expect(reservasAsignadas).toBe(delAnuncio.length);
    console.log(`mapeo: ${reservasAsignadas} reservas asignadas de una`);

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
});
