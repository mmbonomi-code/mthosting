/**
 * Lo que el personal de limpieza puede leer y tocar por la API, contra la
 * base DEV (20260923200000_cerrar_a_limpieza.sql).
 *
 * El guardián de pantallas no alcanza: con su sesión cualquiera consulta la
 * base directo. Esto entra como una limpiadora de verdad —usuario de Auth,
 * ficha con rol limpieza— y prueba la puerta de la base.
 *
 * Crea un usuario y una ficha de prueba y los borra al final.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !anon || !clave)("RLS del rol limpieza (base dev)", () => {
  const admin = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const email = `prueba-rls-${randomUUID().slice(0, 8)}@mthosting.test`;
  const password = `Prueba-${randomUUID()}`;
  let usuarioId: string | null = null;
  let personaId: string | null = null;
  let limpia: SupabaseClient<Database>;
  const limpiezasCreadas: string[] = [];

  async function entrar(): Promise<{ cliente: SupabaseClient<Database>; error: unknown }> {
    const cliente = createClient<Database>(url!, anon!, { auth: { persistSession: false } });
    const { error } = await cliente.auth.signInWithPassword({ email, password });
    return { cliente, error };
  }

  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    usuarioId = data.user.id;

    const { data: persona, error: errorPersona } = await admin
      .from("personas")
      .insert({ nombre: "PRUEBA RLS limpieza", rol: "limpieza", activo: true, profile_id: usuarioId })
      .select("id")
      .single();
    if (errorPersona) throw errorPersona;
    personaId = persona.id;

    const sesion = await entrar();
    if (sesion.error) throw sesion.error;
    limpia = sesion.cliente;
  });

  afterAll(async () => {
    if (limpiezasCreadas.length > 0) {
      await admin.from("limpieza_checklist").delete().in("limpieza_id", limpiezasCreadas);
      await admin.from("limpiezas").delete().in("id", limpiezasCreadas);
    }
    if (personaId) await admin.from("personas").delete().eq("id", personaId);
    if (usuarioId) await admin.auth.admin.deleteUser(usuarioId);
  });

  it("no lee la auditoría, que trae las credenciales de Airbnb", async () => {
    const { data } = await limpia.from("audit_log").select("id").limit(5);
    expect(data ?? []).toEqual([]);
  });

  it("no lee propietarios, liquidaciones ni tarifas", async () => {
    for (const tabla of ["propietarios", "liquidaciones", "tarifas", "parametros_operativos"] as const) {
      const { data } = await limpia.from(tabla).select("id").limit(5);
      expect(data ?? [], tabla).toEqual([]);
    }
  });

  it("no puede cambiar una tarifa", async () => {
    const { data: tarifa } = await admin.from("tarifas").select("id").limit(1).maybeSingle();
    if (!tarifa) return;
    const { data } = await limpia
      .from("tarifas")
      .update({ vigente_hasta: "1999-01-01" })
      .eq("id", tarifa.id)
      .select("id");
    expect(data ?? []).toEqual([]);
  });

  it("sí lee lo que usan sus pantallas: el catálogo de ítems y la ficha", async () => {
    const { data: items } = await limpia.from("item_catalogo").select("id").limit(1);
    expect((items ?? []).length).toBe(1);
    const { data: fichas } = await limpia.from("departamentos_ficha").select("id").limit(1);
    expect((fichas ?? []).length).toBe(1);
  });

  it("dada de baja, la ficha de departamentos le queda vacía", async () => {
    await admin.from("personas").update({ activo: false }).eq("id", personaId!);
    const { data } = await limpia.from("departamentos_ficha").select("id").limit(1);
    expect(data ?? []).toEqual([]);
    await admin.from("personas").update({ activo: true }).eq("id", personaId!);
  });

  it("con el usuario bloqueado no puede volver a entrar, y desbloqueado sí", async () => {
    await admin.auth.admin.updateUserById(usuarioId!, { ban_duration: "876000h" });
    const bloqueada = await entrar();
    expect((bloqueada.error as { code?: string } | null)?.code).toBe("user_banned");

    await admin.auth.admin.updateUserById(usuarioId!, { ban_duration: "none" });
    const devuelta = await entrar();
    expect(devuelta.error).toBeNull();
  });

  it("ve la limpieza anterior del depto y sus tareas periódicas aunque las haya hecho otra", async () => {
    const [{ data: depto }, { data: tarea }] = await Promise.all([
      admin.from("departamentos").select("id").limit(1).single(),
      admin.from("tareas_periodicas_catalogo").select("id, item").eq("activo", true).limit(1).single(),
    ]);
    // La anterior, de nadie (o de otra): RLS no se la muestra por la tabla.
    const { data: previa } = await admin
      .from("limpiezas")
      .insert({
        depto_id: depto!.id,
        fecha: "2099-12-20",
        tipo: "normal",
        estado: "hecha",
        observacion_proxima: "PRUEBA: la llave de la terraza está en el cajón",
      })
      .select("id")
      .single();
    limpiezasCreadas.push(previa!.id);
    await admin.from("limpieza_checklist").insert({
      limpieza_id: previa!.id,
      seccion: "Periódica",
      item: tarea!.item,
      hecho: true,
      tarea_periodica_id: tarea!.id,
    });
    // La suya.
    const { data: mia } = await admin
      .from("limpiezas")
      .insert({ depto_id: depto!.id, fecha: "2099-12-30", tipo: "normal", estado: "pendiente", asignado_a: personaId! })
      .select("id")
      .single();
    limpiezasCreadas.push(mia!.id);

    const { data: porTabla } = await limpia.from("limpiezas").select("id").eq("id", previa!.id);
    expect(porTabla ?? []).toEqual([]);

    const { data: anteriores, error } = await limpia.rpc("limpiezas_anteriores", { p_ids: [mia!.id] });
    expect(error).toBeNull();
    expect(anteriores).toEqual([
      {
        limpieza_id: mia!.id,
        fecha: "2099-12-20",
        observacion_proxima: "PRUEBA: la llave de la terraza está en el cajón",
      },
    ]);

    const { data: periodicas } = await limpia.rpc("periodicas_del_depto", { p_limpieza_id: mia!.id });
    expect(periodicas).toContainEqual({ tarea_periodica_id: tarea!.id, fecha: "2099-12-20" });
  });

  it("no le cuenta nada de una limpieza que no es suya", async () => {
    const ajena = limpiezasCreadas[0];
    const { data: anteriores } = await limpia.rpc("limpiezas_anteriores", { p_ids: [ajena] });
    expect(anteriores ?? []).toEqual([]);
    const { data: periodicas } = await limpia.rpc("periodicas_del_depto", { p_limpieza_id: ajena });
    expect(periodicas ?? []).toEqual([]);
  });
});
