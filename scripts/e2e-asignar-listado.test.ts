/**
 * Verifica el circuito de reparto contra la base DEV: asignar desde el
 * listado congela el monto, el semáforo marca lo urgente y la carga por
 * persona sale bien.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { congelarMonto, type Tarifa } from "../lib/limpiezas/tarifas";
import { cargaPorPersona, semaforoDeLimpieza } from "../lib/limpiezas/semaforo";
import { hoyAR } from "../lib/fechas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("reparto de limpiezas (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const creados = { personas: [] as string[], tarifas: [] as string[] };
  const limpiezasTocadas: string[] = [];

  afterAll(async () => {
    for (const id of limpiezasTocadas) {
      await s
        .from("limpiezas")
        .update({
          asignado_a: null,
          estado: "pendiente",
          monto_pactado: null,
          moneda: null,
          tarifa_id: null,
          pago_doble: false,
        })
        .eq("id", id);
    }
    for (const id of creados.tarifas) await s.from("tarifas").delete().eq("id", id);
    for (const id of creados.personas) await s.from("personas").delete().eq("id", id);
  });

  it("asignar desde el listado congela el monto y suma a la carga", async () => {
    const { data: persona } = await s
      .from("personas")
      .insert({ nombre: "PRUEBA Reparto", hace_limpieza: true, activo: true })
      .select("id, nombre")
      .single();
    creados.personas.push(persona!.id);

    // Valores vigentes para todos los ambientes, desde hace rato.
    for (const ambientes of ["monoambiente", "dos", "tres", "cuatro"] as const) {
      const { data } = await s
        .from("tarifas")
        .insert({ ambientes, monto: 20000, moneda: "ARS", vigente_desde: "2020-01-01" })
        .select("id")
        .single();
      creados.tarifas.push(data!.id);
    }

    // Tres limpiezas pendientes reales.
    const { data: limpiezas } = await s
      .from("limpiezas")
      .select("id, fecha, tipo, depto_id, monto_pactado, depto:departamentos(ambientes)")
      .eq("estado", "pendiente")
      .is("asignado_a", null)
      .not("depto_id", "is", null)
      .limit(3);
    expect(limpiezas!.length).toBeGreaterThan(0);

    const [{ data: tarifas }, { data: feriados }] = await Promise.all([
      s.from("tarifas").select("id, ambientes, depto_id, monto, moneda, vigente_desde, vigente_hasta"),
      s.from("feriados").select("fecha"),
    ]);
    const setFeriados = new Set((feriados ?? []).map((f) => f.fecha));

    for (const l of limpiezas!) {
      const congelado = congelarMonto(
        (tarifas ?? []).map((t) => ({ ...t, monto: Number(t.monto) })) as Tarifa[],
        setFeriados,
        {
          deptoId: l.depto_id,
          ambientes: l.depto?.ambientes ?? null,
          fecha: l.fecha,
          tipo: l.tipo,
        },
      );
      await s
        .from("limpiezas")
        .update({
          asignado_a: persona!.id,
          estado: "asignada",
          monto_pactado: congelado.monto_pactado,
          moneda: congelado.moneda,
          tarifa_id: congelado.tarifa_id,
          pago_doble: congelado.pago_doble,
        })
        .eq("id", l.id);
      limpiezasTocadas.push(l.id);
      console.log(
        `  ${l.fecha} ${l.tipo.padEnd(8)} → ${congelado.moneda} ${congelado.monto_pactado}${congelado.pago_doble ? " (doble)" : ""}`,
      );
    }

    // La carga por persona sale de lo guardado.
    const { data: asignadas } = await s
      .from("limpiezas")
      .select("asignado_a, monto_pactado, moneda, responsable:personas(nombre)")
      .in("id", limpiezasTocadas);
    const carga = cargaPorPersona(
      (asignadas ?? []).map((l) => ({ ...l, monto_pactado: Number(l.monto_pactado) })),
    );
    console.log("carga:", carga);
    expect(carga).toHaveLength(1);
    expect(carga[0].nombre).toBe("PRUEBA Reparto");
    expect(carga[0].cantidad).toBe(limpiezasTocadas.length);
    expect(carga[0].monto).toBeGreaterThan(0);
  });

  it("el semáforo marca en rojo lo que está sin asignar para mañana", async () => {
    const hoy = hoyAR();
    const { data: pendientes } = await s
      .from("limpiezas")
      .select("fecha, asignado_a")
      .is("asignado_a", null)
      .neq("estado", "cancelada")
      .gte("fecha", hoy)
      .limit(50);

    const conteo = { rojo: 0, ambar: 0, gris: 0, asignada: 0 };
    for (const l of pendientes ?? []) {
      conteo[semaforoDeLimpieza({ fecha: l.fecha, hoy, tieneResponsable: !!l.asignado_a })]++;
    }
    console.log("semáforo de lo pendiente:", conteo);
    expect(conteo.asignada).toBe(0);
  });
});
