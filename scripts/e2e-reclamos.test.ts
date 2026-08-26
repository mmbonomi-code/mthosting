/**
 * Verifica el módulo de reclamos contra la base DEV: la forma de las tablas,
 * el bucket privado, la restricción de un reclamo por reserva y los plazos
 * calculados sobre una reserva real. Limpia lo que crea.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { plazosDeReclamo, semaforoDeReclamo } from "../lib/reclamos/plazos";
import { fotosDeLimpieza } from "../lib/reclamos/fotos-limpieza";
import { BUCKET } from "../lib/reclamos/storage";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("reclamos (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const creados: string[] = [];

  /** Una reserva viva que todavía no tenga reclamo: la restricción es única. */
  async function unaReservaSinReclamo(): Promise<string> {
    const { data: usados } = await s.from("reclamos").select("reserva_id");
    const tomadas = new Set((usados ?? []).map((r) => r.reserva_id));

    const { data: candidatas } = await s
      .from("reservas")
      .select("id")
      .eq("cancelada", false)
      .eq("descartada", false)
      .not("depto_id", "is", null)
      .order("fecha_checkin")
      .limit(30);
    const libre = (candidatas ?? []).find((r) => !tomadas.has(r.id));
    expect(libre).toBeTruthy();
    return libre!.id;
  }

  afterAll(async () => {
    for (const id of creados) {
      await s.from("reclamo_fotos").delete().eq("reclamo_id", id);
      await s.from("reclamos").delete().eq("id", id);
    }
  });

  it("el bucket de fotos existe y es privado", async () => {
    const { data, error } = await s.storage.listBuckets();
    expect(error).toBeNull();
    const bucket = data!.find((b) => b.name === "reclamos");
    expect(bucket).toBeTruthy();
    expect(bucket!.public).toBe(false);
  });

  it("crea un reclamo sobre una reserva real y calcula sus plazos", async () => {
    const { data: reserva } = await s
      .from("reservas")
      .select("id, codigo_reserva, fecha_checkout, huesped_nombre")
      .eq("cancelada", false)
      .eq("descartada", false)
      .not("fecha_checkout", "is", null)
      .not("depto_id", "is", null)
      .order("fecha_checkout", { ascending: false })
      .limit(1)
      .single();
    expect(reserva).toBeTruthy();

    const { data: reclamo, error } = await s
      .from("reclamos")
      .insert({
        reserva_id: reserva!.id,
        categoria: "mobiliario",
        motivo: "PRUEBA e2e — rompieron una silla",
        monto_reclamado: 120,
      })
      .select("id, estado, moneda, monto_reclamado, activo")
      .single();
    expect(error).toBeNull();
    creados.push(reclamo!.id);

    // Los valores por defecto son los que dice la especificación.
    expect(reclamo!.estado).toBe("borrador");
    expect(reclamo!.moneda).toBe("USD");
    expect(reclamo!.activo).toBe(true);

    const plazos = plazosDeReclamo(reserva!.fecha_checkout!, "borrador");
    const estado = semaforoDeReclamo(reserva!.fecha_checkout!, "borrador", "2026-08-11");
    console.log(
      `reserva ${reserva!.codigo_reserva} sale ${reserva!.fecha_checkout} · ` +
        `presentar hasta ${plazos.limite_resolucion} · AirCover hasta ${plazos.limite_aircover} · ` +
        `semáforo ${estado.semaforo} (${estado.dias} días)`,
    );
    expect(plazos.limite_vigente).toBe(plazos.limite_resolucion);
  });

  it("no deja cargar dos reclamos sobre la misma reserva", async () => {
    const { data: reclamo } = await s
      .from("reclamos")
      .select("reserva_id")
      .eq("id", creados[0])
      .single();

    const { error } = await s
      .from("reclamos")
      .insert({ reserva_id: reclamo!.reserva_id, motivo: "PRUEBA duplicada" });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/duplicate|unique/i);
  });

  it("rechaza un monto reclamado que no sea mayor a cero", async () => {
    const reserva = await unaReservaSinReclamo();

    const { error } = await s
      .from("reclamos")
      .insert({ reserva_id: reserva, motivo: "PRUEBA", monto_reclamado: 0 });
    expect(error).toBeTruthy();
    // Que falle por el monto, no por otra cosa.
    expect(error!.message).toMatch(/monto_reclamado/);
  });

  it("un borrador puede guardarse sin monto", async () => {
    // Otra reserva, porque la de más arriba ya tiene reclamo.
    const libre = await unaReservaSinReclamo();

    const { data, error } = await s
      .from("reclamos")
      .insert({ reserva_id: libre, motivo: "PRUEBA sin monto todavía" })
      .select("id, monto_reclamado")
      .single();
    expect(error).toBeNull();
    creados.push(data!.id);
    expect(data!.monto_reclamado).toBeNull();
  });

  it("la auditoría registra el alta del reclamo", async () => {
    const { data } = await s
      .from("audit_log")
      .select("accion")
      .eq("tabla", "reclamos")
      .eq("registro_id", creados[0]);
    expect(data!.some((f) => f.accion === "INSERT")).toBe(true);
  });

  it("una reserva sin fotos de limpieza no adjunta nada", async () => {
    // El módulo de limpieza ya existe (Fase 2), pero esta reserva no tiene
    // limpiezas con fotos de daño: la lista viene vacía sin romper el alta.
    const { data: reclamo } = await s
      .from("reclamos")
      .select("reserva_id")
      .eq("id", creados[0])
      .single();
    expect(await fotosDeLimpieza(s, reclamo!.reserva_id, creados[0])).toEqual([]);
  });

  it("sube evidencia al bucket privado y la sirve con URL firmada", async () => {
    const reclamoId = creados[0];
    const ruta = `${reclamoId}/${crypto.randomUUID()}.txt`;
    const contenido = new Blob(["PRUEBA e2e de evidencia"], { type: "text/plain" });

    const { error: errorSubida } = await s.storage.from(BUCKET).upload(ruta, contenido);
    expect(errorSubida).toBeNull();

    const { data: fila, error: errorFila } = await s
      .from("reclamo_fotos")
      .insert({ reclamo_id: reclamoId, storage_path: ruta, origen: "manual" })
      .select("id, activo, origen")
      .single();
    expect(errorFila).toBeNull();
    expect(fila!.activo).toBe(true);

    // El bucket es privado: sin firma no se puede leer.
    const { data: publica } = s.storage.from(BUCKET).getPublicUrl(ruta);
    const respuestaSinFirma = await fetch(publica.publicUrl);
    expect(respuestaSinFirma.ok).toBe(false);

    // Con firma sí, y el contenido es el que se subió.
    const { data: firmada, error: errorFirma } = await s.storage
      .from(BUCKET)
      .createSignedUrl(ruta, 60);
    expect(errorFirma).toBeNull();
    const respuesta = await fetch(firmada!.signedUrl);
    expect(respuesta.ok).toBe(true);
    expect(await respuesta.text()).toBe("PRUEBA e2e de evidencia");

    // Sacarla de la evidencia es una baja lógica: el archivo sigue estando.
    await s.from("reclamo_fotos").update({ activo: false }).eq("id", fila!.id);
    const { data: despues } = await s.storage
      .from(BUCKET)
      .createSignedUrl(ruta, 60);
    expect(despues?.signedUrl).toBeTruthy();

    await s.storage.from(BUCKET).remove([ruta]);
  });
});
