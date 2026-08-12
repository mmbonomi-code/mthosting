/**
 * Módulo Reporte contra la base DEV: que las notas y el equipamiento se
 * guarden, que el estado hecho no borre nada, y sobre todo que lo cargado
 * aparezca el día que corresponde en la vista del día. Limpia lo que crea.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import {
  contarUrgentes,
  estadoDePlazo,
  ordenarPorUrgencia,
  vigenteEl,
  type Nota,
} from "../lib/reporte/notas";
import { enUsoEl, seEntregaEl, type Equipamiento } from "../lib/reporte/equipamiento";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("reporte (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const notas: string[] = [];
  const equipos: string[] = [];

  afterAll(async () => {
    for (const id of notas) await s.from("notas_reporte").delete().eq("id", id);
    for (const id of equipos) await s.from("equipamiento_bebe").delete().eq("id", id);
  });

  const HOY = "2026-08-11";

  it("guarda un pendiente con responsable y departamento", async () => {
    const [{ data: depto }, { data: persona }] = await Promise.all([
      s.from("departamentos").select("id, codigo").eq("estado", "activo").limit(1).single(),
      s.from("personas").select("id, nombre").eq("activo", true).limit(1).single(),
    ]);

    const { data, error } = await s
      .from("notas_reporte")
      .insert({
        seccion: "pendiente",
        titulo: "PRUEBA e2e — abonar sillas al tapicero",
        detalle: "Paga Magui. Insistirle.",
        fecha: HOY,
        depto_id: depto!.id,
        responsable_id: persona!.id,
      })
      .select("id, estado, activo, seccion")
      .single();

    expect(error).toBeNull();
    notas.push(data!.id);
    expect(data!.estado).toBe("pendiente");
    expect(data!.activo).toBe(true);
    console.log(`pendiente creado en ${depto!.codigo} para ${persona!.nombre}`);
  });

  it("marcar hecho no borra nada: queda con quién y cuándo", async () => {
    const id = notas[0];
    const cuando = new Date().toISOString();

    await s
      .from("notas_reporte")
      .update({ estado: "hecho", hecho_at: cuando })
      .eq("id", id);

    const { data } = await s
      .from("notas_reporte")
      .select("estado, hecho_at, titulo, activo")
      .eq("id", id)
      .single();

    expect(data!.estado).toBe("hecho");
    expect(data!.hecho_at).toBeTruthy();
    // El texto sigue estando: es lo que el cuadro de texto no permitía.
    expect(data!.titulo).toMatch(/tapicero/);
    expect(data!.activo).toBe(true);

    await s.from("notas_reporte").update({ estado: "pendiente", hecho_at: null }).eq("id", id);
  });

  it("un anuncio con tramo vale adentro del tramo y no fuera", async () => {
    const { data: depto } = await s
      .from("departamentos")
      .select("id, codigo")
      .eq("estado", "activo")
      .limit(1)
      .single();

    const { data, error } = await s
      .from("notas_reporte")
      .insert({
        seccion: "anuncio",
        titulo: "PRUEBA e2e — pintan la pared",
        fecha: "2026-08-28",
        fecha_hasta: "2026-08-29",
        depto_id: depto!.id,
      })
      .select("id, seccion, titulo, detalle, fecha, fecha_hasta, estado")
      .single();
    expect(error).toBeNull();
    equiposLimpiar(notas, data!.id);

    const nota: Nota = {
      id: data!.id,
      seccion: "anuncio",
      titulo: data!.titulo,
      detalle: data!.detalle,
      fecha: data!.fecha,
      fecha_hasta: data!.fecha_hasta,
      depto_id: depto!.id,
      depto_codigo: depto!.codigo,
      responsable_id: null,
      responsable_nombre: null,
      estado: "pendiente",
    };

    expect(vigenteEl(nota, "2026-08-27")).toBe(false);
    expect(vigenteEl(nota, "2026-08-28")).toBe(true);
    expect(vigenteEl(nota, "2026-08-29")).toBe(true);
    expect(vigenteEl(nota, "2026-08-30")).toBe(false);
  });

  it("la base rechaza un tramo al revés", async () => {
    const { error } = await s.from("notas_reporte").insert({
      seccion: "anuncio",
      titulo: "PRUEBA e2e — tramo invertido",
      fecha: "2026-08-29",
      fecha_hasta: "2026-08-28",
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/check|constraint/i);
  });

  it("una cuna colgada de una reserva toma su departamento y sus fechas", async () => {
    const { data: reserva } = await s
      .from("reservas")
      .select("id, codigo_reserva, huesped_nombre, depto_id, fecha_checkin, fecha_checkout, depto:departamentos(codigo)")
      .eq("cancelada", false)
      .eq("descartada", false)
      .not("depto_id", "is", null)
      .not("fecha_checkin", "is", null)
      .order("fecha_checkin", { ascending: false })
      .limit(1)
      .single();

    const { data, error } = await s
      .from("equipamiento_bebe")
      .insert({
        tipo: "cuna",
        reserva_id: reserva!.id,
        depto_id: reserva!.depto_id,
        fecha_desde: reserva!.fecha_checkin!,
        fecha_hasta: reserva!.fecha_checkout!,
        notas: "PRUEBA e2e",
      })
      .select("id, tipo, estado, fecha_desde, fecha_hasta")
      .single();

    expect(error).toBeNull();
    equipos.push(data!.id);
    expect(data!.estado).toBe("pedido");

    const equipo: Equipamiento = {
      id: data!.id,
      tipo: "cuna",
      reserva_id: reserva!.id,
      codigo_reserva: reserva!.codigo_reserva,
      huesped_nombre: reserva!.huesped_nombre,
      depto_id: reserva!.depto_id,
      depto_codigo: reserva!.depto?.codigo ?? null,
      fecha_desde: data!.fecha_desde,
      fecha_hasta: data!.fecha_hasta,
      estado: "pedido",
      notas: "PRUEBA e2e",
    };

    console.log(
      `cuna para ${reserva!.depto?.codigo} del ${data!.fecha_desde} al ${data!.fecha_hasta}`,
    );
    expect(seEntregaEl(equipo, data!.fecha_desde)).toBe(true);
    expect(enUsoEl(equipo, data!.fecha_desde)).toBe(true);
    expect(enUsoEl(equipo, data!.fecha_hasta)).toBe(true);
  });

  it("la base exige que el equipamiento cuelgue de algo", async () => {
    const { error } = await s.from("equipamiento_bebe").insert({
      tipo: "silla",
      fecha_desde: "2026-08-15",
      fecha_hasta: "2026-08-16",
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/check|constraint/i);
  });

  it("la consulta de la vista del día trae lo que corresponde a ese día", async () => {
    const { data: equipo } = await s
      .from("equipamiento_bebe")
      .select("fecha_desde, fecha_hasta, depto_id")
      .eq("id", equipos[0])
      .single();

    const dia = equipo!.fecha_desde;

    // La misma consulta que hace AvisosDelDia.
    const { data, error } = await s
      .from("equipamiento_bebe")
      .select("id")
      .eq("activo", true)
      .neq("estado", "retirado")
      .lte("fecha_desde", dia)
      .gte("fecha_hasta", dia);

    expect(error).toBeNull();
    expect(data!.map((e) => e.id)).toContain(equipos[0]);

    // Un día antes no tiene que aparecer.
    const antes = new Date(Date.parse(`${dia}T00:00:00Z`) - 86400000)
      .toISOString()
      .slice(0, 10);
    const { data: sinNada } = await s
      .from("equipamiento_bebe")
      .select("id")
      .eq("activo", true)
      .neq("estado", "retirado")
      .lte("fecha_desde", antes)
      .gte("fecha_hasta", antes);
    expect(sinNada!.map((e) => e.id)).not.toContain(equipos[0]);
  });

  it("ordena y cuenta lo urgente con los datos reales", async () => {
    const { data } = await s
      .from("notas_reporte")
      .select(
        `id, seccion, titulo, detalle, fecha, fecha_hasta, estado,
         depto:departamentos(id, codigo), responsable:personas(id, nombre)`,
      )
      .eq("activo", true)
      .eq("seccion", "pendiente");

    const lista: Nota[] = (data ?? []).map((n) => ({
      id: n.id,
      seccion: "pendiente",
      titulo: n.titulo,
      detalle: n.detalle,
      fecha: n.fecha,
      fecha_hasta: n.fecha_hasta,
      depto_id: n.depto?.id ?? null,
      depto_codigo: n.depto?.codigo ?? null,
      responsable_id: n.responsable?.id ?? null,
      responsable_nombre: n.responsable?.nombre ?? null,
      estado: n.estado as Nota["estado"],
    }));

    const ordenada = ordenarPorUrgencia(lista, HOY);
    console.log(
      `pendientes: ${lista.length}, urgentes: ${contarUrgentes(lista, HOY)}`,
      ordenada.slice(0, 3).map((n) => `${n.titulo} (${estadoDePlazo(n, HOY)})`),
    );
    expect(ordenada.length).toBe(lista.length);
  });
});

/** Empuja el id a la lista de limpieza. */
function equiposLimpiar(lista: string[], id: string) {
  lista.push(id);
}
