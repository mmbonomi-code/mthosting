/**
 * Lo que logística puede leer y marcar por la API, contra la base DEV
 * (20261002100100_logistica.sql).
 *
 * El guardián de pantallas no alcanza: con su sesión cualquiera consulta la
 * base directo. Esto entra como logística de verdad —usuario de Auth, ficha
 * con rol logistica— y prueba la puerta de la base: escribir directo, nada;
 * marcar por las funciones, solo lo suyo.
 *
 * Crea un usuario, una ficha, una limpieza y un pedido de cuna de prueba y
 * los borra al final. La llegada con candado es una real: se deja como
 * estaba.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !anon || !clave)("RLS del rol logística (base dev)", () => {
  const admin = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const email = `prueba-logistica-${randomUUID().slice(0, 8)}@mthosting.test`;
  const password = `Prueba-${randomUUID()}`;
  let usuarioId: string | null = null;
  let personaId: string | null = null;
  let logistica: SupabaseClient<Database>;
  let limpiezaId: string | null = null;
  let equipoId: string | null = null;
  let deptoId: string;

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    usuarioId = data.user.id;

    const { data: persona, error: errorPersona } = await admin
      .from("personas")
      .insert({ nombre: "PRUEBA RLS logística", rol: "logistica", activo: true, profile_id: usuarioId })
      .select("id")
      .single();
    if (errorPersona) throw errorPersona;
    personaId = persona.id;

    const { data: depto } = await admin.from("departamentos").select("id").limit(1).single();
    deptoId = depto!.id;

    const { data: limpieza, error: errorLimpieza } = await admin
      .from("limpiezas")
      .insert({ depto_id: deptoId, fecha: "2099-01-01", tipo: "normal", estado: "pendiente" })
      .select("id")
      .single();
    if (errorLimpieza) throw errorLimpieza;
    limpiezaId = limpieza.id;

    const { data: equipo, error: errorEquipo } = await admin
      .from("equipamiento_bebe")
      .insert({ tipo: "cuna", depto_id: deptoId, fecha_desde: "2099-01-01", fecha_hasta: "2099-01-05" })
      .select("id")
      .single();
    if (errorEquipo) throw errorEquipo;
    equipoId = equipo.id;

    logistica = createClient<Database>(url!, anon!, { auth: { persistSession: false } });
    const { error: errorSesion } = await logistica.auth.signInWithPassword({ email, password });
    if (errorSesion) throw errorSesion;
  });

  afterAll(async () => {
    if (limpiezaId) await admin.from("limpiezas").delete().eq("id", limpiezaId);
    if (equipoId) await admin.from("equipamiento_bebe").delete().eq("id", equipoId);
    if (personaId) await admin.from("personas").delete().eq("id", personaId);
    if (usuarioId) await admin.auth.admin.deleteUser(usuarioId);
  });

  it("lee lo que usa su pantalla: limpiezas, llegadas, cunas y reporte", async () => {
    for (const tabla of ["limpiezas", "eventos_estadia", "equipamiento_bebe", "notas_reporte"] as const) {
      const { error } = await logistica.from(tabla).select("id").limit(1);
      expect(error, tabla).toBeNull();
    }
    const { data } = await logistica.from("limpiezas").select("id").eq("id", limpiezaId!);
    expect(data?.length).toBe(1);
  });

  it("no escribe directo: ni reasignar una limpieza ni cambiar el estado de una cuna", async () => {
    const { data: limpieza } = await logistica
      .from("limpiezas")
      .update({ estado: "hecha" })
      .eq("id", limpiezaId!)
      .select("id");
    expect(limpieza ?? []).toEqual([]);

    const { data: equipo } = await logistica
      .from("equipamiento_bebe")
      .update({ estado: "entregado" })
      .eq("id", equipoId!)
      .select("id");
    expect(equipo ?? []).toEqual([]);

    const { data: real } = await admin.from("limpiezas").select("estado").eq("id", limpiezaId!).single();
    expect(real!.estado).toBe("pendiente");
  });

  it("no carga notas en el reporte: sus pendientes los lee", async () => {
    const { error } = await logistica
      .from("notas_reporte")
      .insert({ seccion: "pendiente", titulo: "PRUEBA no debería entrar" });
    expect(error).not.toBeNull();
  });

  it("marca y desmarca la ropa blanca, con quién y cuándo", async () => {
    const { error } = await logistica.rpc("logistica_marcar_ropa", {
      p_limpieza: limpiezaId!,
      p_que: "blanco",
      p_valor: true,
    });
    expect(error).toBeNull();
    const { data: marcada } = await admin
      .from("limpiezas")
      .select("blanco_entregado_at, blanco_entregado_por, sucio_retirado_at, estado")
      .eq("id", limpiezaId!)
      .single();
    expect(marcada!.blanco_entregado_at).not.toBeNull();
    expect(marcada!.blanco_entregado_por).toBe(usuarioId);
    // Lo otro queda como estaba.
    expect(marcada!.sucio_retirado_at).toBeNull();
    expect(marcada!.estado).toBe("pendiente");

    await logistica.rpc("logistica_marcar_ropa", { p_limpieza: limpiezaId!, p_que: "blanco", p_valor: false });
    const { data: desmarcada } = await admin
      .from("limpiezas")
      .select("blanco_entregado_at, blanco_entregado_por")
      .eq("id", limpiezaId!)
      .single();
    expect(desmarcada).toEqual({ blanco_entregado_at: null, blanco_entregado_por: null });
  });

  it("marca la cuna entregada y retirada", async () => {
    for (const estado of ["entregado", "retirado", "pedido"] as const) {
      const { error } = await logistica.rpc("logistica_marcar_equipamiento", { p_id: equipoId!, p_estado: estado });
      expect(error, estado).toBeNull();
      const { data } = await admin.from("equipamiento_bebe").select("estado").eq("id", equipoId!).single();
      expect(data!.estado).toBe(estado);
    }
  });

  it("sin foto no marca la llave", async () => {
    const { error } = await logistica.rpc("logistica_dejar_llave", { p_evento: randomUUID(), p_foto: " " });
    expect(error?.message).toMatch(/foto/);
  });

  it("deja la llave de una llegada con foto, y se puede deshacer", async () => {
    const { data: evento } = await admin
      .from("eventos_estadia")
      .select("id, acceso_dejado, acceso_dejado_at, acceso_dejado_por, acceso_foto")
      .eq("tipo", "checkin")
      .limit(1)
      .maybeSingle();
    if (!evento) return;

    try {
      const { error } = await logistica.rpc("logistica_dejar_llave", {
        p_evento: evento.id,
        p_foto: "llaves/prueba/foto.jpg",
      });
      expect(error).toBeNull();
      const { data: marcada } = await admin
        .from("eventos_estadia")
        .select("acceso_dejado, acceso_dejado_por, acceso_foto")
        .eq("id", evento.id)
        .single();
      expect(marcada).toEqual({
        acceso_dejado: true,
        acceso_dejado_por: usuarioId,
        acceso_foto: "llaves/prueba/foto.jpg",
      });

      await logistica.rpc("logistica_deshacer_llave", { p_evento: evento.id });
      const { data: deshecha } = await admin
        .from("eventos_estadia")
        .select("acceso_dejado, acceso_foto")
        .eq("id", evento.id)
        .single();
      expect(deshecha).toEqual({ acceso_dejado: false, acceso_foto: null });
    } finally {
      await admin
        .from("eventos_estadia")
        .update({
          acceso_dejado: evento.acceso_dejado,
          acceso_dejado_at: evento.acceso_dejado_at,
          acceso_dejado_por: evento.acceso_dejado_por,
          acceso_foto: evento.acceso_foto,
        })
        .eq("id", evento.id);
    }
  });

  it("una salida no tiene llave que dejar", async () => {
    const { data: salida } = await admin
      .from("eventos_estadia")
      .select("id")
      .eq("tipo", "checkout")
      .limit(1)
      .maybeSingle();
    if (!salida) return;
    const { error } = await logistica.rpc("logistica_dejar_llave", { p_evento: salida.id, p_foto: "x.jpg" });
    expect(error?.message).toMatch(/No se encontró la llegada/);
  });

  it("con otro rol, las funciones de logística no le sirven", async () => {
    await admin.from("personas").update({ rol: "limpieza" }).eq("id", personaId!);
    try {
      const { error } = await logistica.rpc("logistica_marcar_ropa", {
        p_limpieza: limpiezaId!,
        p_que: "sucio",
        p_valor: true,
      });
      expect(error?.message).toMatch(/Tu rol no puede/);
    } finally {
      await admin.from("personas").update({ rol: "logistica" }).eq("id", personaId!);
    }
  });
});
