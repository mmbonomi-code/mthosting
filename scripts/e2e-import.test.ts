/**
 * Prueba de punta a punta contra la base DEV con archivos reales.
 * Se corre a mano: npx vitest run scripts/e2e-import.test.ts
 * Requiere NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { ejecutarImportacion } from "../lib/importador/ejecutar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("importación de punta a punta (base dev)", () => {
  it("importa 4 archivos reales y re-importarlos produce cero cambios", async () => {
    const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

    const nombres = [
      "reservations - 2026-08-02T084519.336.csv",
      "reservations - 2026-08-02T084528.880.csv",
      "reservations - 2026-08-02T084540.299.csv",
      "reservations - 2026-08-02T084550.146.csv",
    ];
    const contenidos = nombres.map((nombre) => ({
      nombre,
      contenido: readFileSync(`C:/Users/negro/Downloads/${nombre}`, "utf8"),
    }));

    const primera = await ejecutarImportacion(s, contenidos, null);
    console.log("1ª:", JSON.stringify({ ...primera, anomalias: primera.anomalias.length, advertencias: undefined }));

    const segunda = await ejecutarImportacion(s, contenidos, null);
    console.log("2ª:", JSON.stringify({ ...segunda, anomalias: segunda.anomalias.length, advertencias: undefined }));

    // Idempotencia: la segunda pasada no cambia absolutamente nada.
    expect(segunda.nuevas).toBe(0);
    expect(segunda.actualizadas).toBe(0);
    expect(segunda.sin_cambios).toBe(primera.filas_total);

    // Muestra guardada: fechas día-primero y montos con decimales correctos.
    const { data } = await s
      .from("reservas")
      .select("codigo_reserva, cancelada, fecha_checkin, fecha_checkout, payout_monto, depto:departamentos(codigo)")
      .in("codigo_reserva", ["HMCNXQKHP5", "HMKJ3MSHCN", "HMEHY832ZP"])
      .order("codigo_reserva");
    console.log("muestra:", JSON.stringify(data, null, 1));

    const porCodigo = new Map(data!.map((r) => [r.codigo_reserva, r]));
    // HMCNXQKHP5: 31/7 → 3/8, $ 206,61, anuncio "Tranquilo y familiar en recoleta" → JUNCAL 2
    expect(porCodigo.get("HMCNXQKHP5")).toMatchObject({
      fecha_checkin: "2026-07-31",
      fecha_checkout: "2026-08-03",
      payout_monto: 206.61,
    });
    // HMEHY832ZP: 20/7/2026 → 9/1/2027 (¡día primero!), $ 4.070,32 (¡miles!)
    expect(porCodigo.get("HMEHY832ZP")).toMatchObject({
      fecha_checkin: "2026-07-20",
      fecha_checkout: "2027-01-09",
      payout_monto: 4070.32,
    });
    // HMKJ3MSHCN: cancelada
    expect(porCodigo.get("HMKJ3MSHCN")?.cancelada).toBe(true);
  }, 120000);
});
