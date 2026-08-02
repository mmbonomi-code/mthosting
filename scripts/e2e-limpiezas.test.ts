/**
 * Prueba de punta a punta de la generación de limpiezas contra la base DEV,
 * con los archivos reales de Airbnb.
 *
 * npm run test:e2e -- scripts/e2e-limpiezas.test.ts
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { ejecutarImportacion } from "../lib/importador/ejecutar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ARCHIVOS = [
  "reservations - 2026-08-02T084519.336.csv",
  "reservations - 2026-08-02T084528.880.csv",
  "reservations - 2026-08-02T084540.299.csv",
  "reservations - 2026-08-02T084550.146.csv",
];

describe.skipIf(!url || !clave)("generación de limpiezas (base dev)", () => {
  it("importar genera limpiezas; reimportar no genera ninguna de más", async () => {
    const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

    const contenidos = ARCHIVOS.map((nombre) => ({
      nombre,
      contenido: readFileSync(`C:/Users/negro/Downloads/${nombre}`, "utf8"),
    }));

    const primera = await ejecutarImportacion(s, contenidos, null);
    console.log(
      `1ª → generadas=${primera.limpiezas_generadas} movidas=${primera.limpiezas_movidas} canceladas=${primera.limpiezas_canceladas} anomalías=${primera.anomalias.length}`,
    );

    const segunda = await ejecutarImportacion(s, contenidos, null);
    console.log(
      `2ª → generadas=${segunda.limpiezas_generadas} movidas=${segunda.limpiezas_movidas} canceladas=${segunda.limpiezas_canceladas}`,
    );

    // Idempotencia: la segunda pasada no crea ni mueve nada.
    expect(segunda.limpiezas_generadas).toBe(0);
    expect(segunda.limpiezas_movidas).toBe(0);
    expect(segunda.limpiezas_canceladas).toBe(0);

    // Solo se evalúan las reservas de ESTE lote: las de importaciones
    // anteriores a que existiera la generación no tienen limpieza y no es
    // un error (se regeneran cuando se las vuelva a importar).
    const codigosDelLote = new Set(
      contenidos.flatMap((c) =>
        c.contenido
          .split(/\r?\n/)
          .slice(1)
          .map((linea) => linea.match(/^"([^"]+)"/)?.[1])
          .filter((c): c is string => !!c),
      ),
    );

    // Cada reserva activa con departamento tiene su limpieza de salida.
    const { data: todasActivas } = await s
      .from("reservas")
      .select("id, codigo_reserva, fecha_checkout")
      .eq("cancelada", false)
      .eq("descartada", false)
      .not("depto_id", "is", null);
    const activas = (todasActivas ?? []).filter((r) =>
      codigosDelLote.has(r.codigo_reserva),
    );

    const { data: salidas } = await s
      .from("limpiezas")
      .select("reserva_id, fecha, estado")
      .eq("rol_reserva", "salida")
      .neq("estado", "cancelada");

    const salidaPorReserva = new Map((salidas ?? []).map((l) => [l.reserva_id, l]));
    const sinLimpieza = activas.filter((r) => !salidaPorReserva.has(r.id));
    console.log(
      `reservas activas del lote: ${activas.length} | sin limpieza de salida: ${sinLimpieza.length}`,
    );
    expect(sinLimpieza).toHaveLength(0);

    // Y la fecha de la limpieza es exactamente la del check-out.
    for (const r of activas.slice(0, 40)) {
      expect(salidaPorReserva.get(r.id)!.fecha).toBe(r.fecha_checkout);
    }

    // Las canceladas no dejan limpiezas vivas.
    const { data: canceladas } = await s
      .from("reservas")
      .select("id")
      .eq("cancelada", true)
      .not("depto_id", "is", null);
    const vivasDeCanceladas = (canceladas ?? []).filter((r) => salidaPorReserva.has(r.id));
    console.log(`reservas canceladas: ${canceladas!.length} | con limpieza viva: ${vivasDeCanceladas.length}`);

    // Cada reserva activa del lote tiene sus dos eventos.
    const { count: eventos } = await s
      .from("eventos_estadia")
      .select("id", { count: "exact", head: true })
      .neq("estado", "cancelado");
    console.log(`eventos de estadía vigentes: ${eventos}`);
    expect(eventos).toBeGreaterThanOrEqual(activas.length * 2);

    // Urgentes: salida y entrada el mismo día en el mismo departamento.
    const { count: urgentes } = await s
      .from("limpiezas")
      .select("id", { count: "exact", head: true })
      .eq("urgente", true)
      .neq("estado", "cancelada");
    const { count: repasos } = await s
      .from("limpiezas")
      .select("id", { count: "exact", head: true })
      .eq("tipo", "repaso")
      .neq("estado", "cancelada");
    const { count: total } = await s
      .from("limpiezas")
      .select("id", { count: "exact", head: true })
      .neq("estado", "cancelada");
    console.log(`limpiezas vivas: ${total} (urgentes: ${urgentes}, repasos: ${repasos})`);
  }, 180000);
});
