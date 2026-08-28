/**
 * Prueba de punta a punta de la ficha de limpieza contra la base DEV:
 * asignar un responsable congelando el monto, y el alta manual que detecta
 * sola si hay un huésped adentro.
 *
 * Crea datos de prueba y los borra al terminar.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { congelarMonto, type Tarifa } from "../lib/limpiezas/tarifas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("asignación y alta manual (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const creados = { personas: [] as string[], limpiezas: [] as string[], tarifas: [] as string[] };

  afterAll(async () => {
    for (const id of creados.limpiezas) await s.from("limpiezas").delete().eq("id", id);
    for (const id of creados.tarifas) await s.from("tarifas").delete().eq("id", id);
    for (const id of creados.personas) await s.from("personas").delete().eq("id", id);
  });

  it("asigna una limpieza congelando el monto de la tarifa vigente", async () => {
    // Persona de prueba que hace limpiezas.
    const { data: persona } = await s
      .from("personas")
      .insert({ nombre: "PRUEBA Limpiadora", hace_limpieza: true, activo: true })
      .select("id")
      .single();
    creados.personas.push(persona!.id);

    // Una limpieza real de un departamento con ambientes cargados.
    const { data: limpieza } = await s
      .from("limpiezas")
      .select("id, fecha, tipo, depto_id, depto:departamentos(ambientes)")
      .not("depto_id", "is", null)
      .eq("estado", "pendiente")
      .limit(1)
      .single();
    expect(limpieza).toBeTruthy();

    const ambientes = limpieza!.depto?.ambientes;
    console.log(`limpieza ${limpieza!.fecha}, ambientes=${ambientes}`);

    // Tarifa de prueba vigente para esos ambientes.
    const { data: tarifa } = await s
      .from("tarifas")
      .insert({
        ambientes,
        monto: 25000,
        moneda: "ARS",
        vigente_desde: "2020-01-01",
      })
      .select("id")
      .single();
    creados.tarifas.push(tarifa!.id);

    // Lo mismo que hace la acción de asignar.
    const { data: tarifas } = await s
      .from("tarifas")
      .select("id, ambientes, depto_id, monto, moneda, vigente_desde, vigente_hasta")
      .lte("vigente_desde", limpieza!.fecha);
    const { data: feriados } = await s.from("feriados").select("fecha");

    const congelado = congelarMonto(
      (tarifas ?? []) as Tarifa[],
      new Set((feriados ?? []).map((f) => f.fecha)),
      {
        deptoId: limpieza!.depto_id,
        ambientes: ambientes ?? null,
        fecha: limpieza!.fecha,
        tipo: limpieza!.tipo,
      },
    );
    console.log("congelado:", congelado);
    expect(congelado.tarifa_id).toBe(tarifa!.id);
    // El domingo se guarda duplicado; un repaso, a la mitad.
    const factor = (congelado.pago_doble ? 2 : 1) * (limpieza!.tipo === "repaso" ? 0.5 : 1);
    expect(congelado.monto_pactado).toBe(25000 * factor);

    const { error } = await s
      .from("limpiezas")
      .update({
        asignado_a: persona!.id,
        estado: "asignada",
        monto_pactado: congelado.monto_pactado,
        moneda: congelado.moneda,
        tarifa_id: congelado.tarifa_id,
        pago_doble: congelado.pago_doble,
      })
      .eq("id", limpieza!.id);
    expect(error).toBeNull();

    const { data: verificada } = await s
      .from("limpiezas")
      .select("estado, monto_pactado, moneda, pago_doble, responsable:personas(nombre)")
      .eq("id", limpieza!.id)
      .single();
    console.log("guardada:", verificada);
    expect(verificada!.estado).toBe("asignada");
    expect(verificada!.responsable?.nombre).toBe("PRUEBA Limpiadora");
    expect(verificada!.moneda).toBe("ARS");

    // Deja la limpieza como estaba: la prueba no ensucia la operación.
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
      .eq("id", limpieza!.id);
  });

  it("el alta manual detecta sola que hay un huésped adentro", async () => {
    // Una reserva vigente hoy o en el futuro, con varias noches.
    const { data: reserva } = await s
      .from("reservas")
      .select("id, depto_id, fecha_checkin, fecha_checkout")
      .eq("cancelada", false)
      .eq("descartada", false)
      .not("depto_id", "is", null)
      .gt("noches", 3)
      .limit(1)
      .single();
    expect(reserva).toBeTruthy();

    // Un día en el medio de la estadía: el huésped está adentro.
    const [a, m, d] = reserva!.fecha_checkin!.split("-").map(Number);
    const enElMedio = new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);

    // Lo mismo que hace la acción de alta manual.
    const { data: enCurso } = await s
      .from("reservas")
      .select("id")
      .eq("depto_id", reserva!.depto_id)
      .eq("cancelada", false)
      .eq("descartada", false)
      .lte("fecha_checkin", enElMedio)
      .gt("fecha_checkout", enElMedio)
      .limit(1)
      .maybeSingle();

    console.log(
      `estadía ${reserva!.fecha_checkin} → ${reserva!.fecha_checkout}, limpieza el ${enElMedio}`,
    );
    expect(enCurso?.id).toBe(reserva!.id);

    const { data: creada, error } = await s
      .from("limpiezas")
      .insert({
        depto_id: reserva!.depto_id!,
        fecha: enElMedio,
        tipo: "con_huespedes",
        reserva_id: enCurso!.id,
        rol_reserva: "durante",
        estado: "pendiente",
      })
      .select("id, tipo, rol_reserva")
      .single();
    expect(error).toBeNull();
    creados.limpiezas.push(creada!.id);
    console.log("limpieza creada:", creada);
    expect(creada!.rol_reserva).toBe("durante");
    expect(creada!.tipo).toBe("con_huespedes");
  });

  it("una estadía larga admite VARIAS limpiezas con huéspedes adentro", async () => {
    // Una estadía larga de verdad: en seis meses van varios cambios de
    // blancos, y el índice único los rechazaba a todos menos al primero
    // (ECUADOR 1, 28/08/2026).
    const { data: reserva } = await s
      .from("reservas")
      .select("id, depto_id, fecha_checkin")
      .eq("cancelada", false)
      .eq("descartada", false)
      .not("depto_id", "is", null)
      .gt("noches", 20)
      .limit(1)
      .single();
    expect(reserva).toBeTruthy();

    const [a, m, d] = reserva!.fecha_checkin!.split("-").map(Number);
    const diaDeLaEstadia = (sumar: number) =>
      new Date(Date.UTC(a, m - 1, d + sumar)).toISOString().slice(0, 10);

    for (const dia of [diaDeLaEstadia(7), diaDeLaEstadia(14)]) {
      const { data: creada, error } = await s
        .from("limpiezas")
        .insert({
          depto_id: reserva!.depto_id!,
          fecha: dia,
          tipo: "cambio_blancos",
          reserva_id: reserva!.id,
          rol_reserva: "durante",
          estado: "pendiente",
        })
        .select("id")
        .single();
      expect(error).toBeNull();
      creados.limpiezas.push(creada!.id);
    }
  });
});
