/**
 * Prueba de punta a punta: cuando una reserva cambia de departamento, su
 * limpieza se muda con ella y, si estaba asignada, queda sin responsable y
 * sin monto (decisión del dueño, 13/09/2026). Contra la base DEV.
 *
 * Trabaja con UNA reserva inventada de 2030 y borra SOLO lo que creó.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { generarLimpiezas } from "../lib/limpiezas/generar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CODIGO = "HMPRUEBADEP";
const HOY = "2030-01-01";

describe.skipIf(!url || !clave)("cambio de departamento de una reserva (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  let reservaId: string | null = null;

  afterAll(async () => {
    if (!reservaId) return;
    for (const tabla of ["limpiezas", "eventos_estadia"] as const) {
      const { error } = await s.from(tabla).delete().eq("reserva_id", reservaId);
      expect(error, `no se pudieron borrar ${tabla} de la prueba`).toBeNull();
    }
    const { error } = await s.from("reservas").delete().eq("id", reservaId);
    expect(error, "no se pudo borrar la reserva de la prueba").toBeNull();
  });

  it("la limpieza asignada se muda y queda sin responsable", async () => {
    const { data: previa } = await s.from("reservas").select("id").eq("codigo_reserva", CODIGO).maybeSingle();
    expect(previa, `ya existe ${CODIGO}: quedó sucia una corrida anterior`).toBeNull();

    const [{ data: deptos }, { data: persona }] = await Promise.all([
      s.from("departamentos").select("id").eq("activo", true).order("codigo").limit(2),
      s.from("personas").select("id").eq("activo", true).eq("hace_limpieza", true).limit(1).single(),
    ]);
    const [origen, destino] = deptos!.map((d) => d.id);

    const { data: creada, error } = await s
      .from("reservas")
      .insert({
        codigo_reserva: CODIGO,
        canal: "airbnb",
        origen: "ical",
        datos_completos: false,
        depto_id: origen,
        fecha_checkin: "2030-05-10",
        fecha_checkout: "2030-05-12",
      })
      .select("id")
      .single();
    expect(error).toBeNull();
    reservaId = creada!.id;
    await generarLimpiezas(s, [CODIGO], HOY);

    // Alguien la toma, con su monto congelado.
    const { error: errorAsignar } = await s
      .from("limpiezas")
      .update({ asignado_a: persona!.id, estado: "asignada", monto_pactado: 12345, moneda: "ARS" })
      .eq("reserva_id", reservaId)
      .eq("rol_reserva", "salida");
    expect(errorAsignar).toBeNull();

    // La reserva pasa al otro departamento.
    await s.from("reservas").update({ depto_id: destino }).eq("id", reservaId);
    const resumen = await generarLimpiezas(s, [CODIGO], HOY);
    expect(resumen.anomalias.join(" ")).toContain("sin responsable");

    const { data: salida } = await s
      .from("limpiezas")
      .select("depto_id, asignado_a, estado, monto_pactado, moneda, fecha")
      .eq("reserva_id", reservaId)
      .eq("rol_reserva", "salida")
      .single();
    expect(salida).toEqual({
      depto_id: destino,
      asignado_a: null,
      estado: "pendiente",
      monto_pactado: null,
      moneda: null,
      fecha: "2030-05-12",
    });

    // No quedó ninguna limpieza viva de la reserva en el edificio viejo.
    const { count } = await s
      .from("limpiezas")
      .select("id", { count: "exact", head: true })
      .eq("reserva_id", reservaId)
      .eq("depto_id", origen)
      .neq("estado", "cancelada");
    expect(count).toBe(0);

    // Recalcular otra vez no cambia nada.
    const otra = await generarLimpiezas(s, [CODIGO], HOY);
    expect(otra.movidas).toBe(0);
  });
});
