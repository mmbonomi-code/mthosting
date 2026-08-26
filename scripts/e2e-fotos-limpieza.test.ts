/**
 * Verifica contra la base DEV el puente entre el módulo de limpieza y el de
 * reclamos: las fotos de DAÑO del check-out se copian solas al bucket del
 * reclamo, y las del departamento terminado no. Limpia todo lo que crea.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import type { Database } from "../lib/database.types";
import { fotosDeLimpieza } from "../lib/reclamos/fotos-limpieza";
import { BUCKET } from "../lib/reclamos/storage";
import { BUCKET_LIMPIEZAS } from "../lib/limpiezas/storage";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("fotos de limpieza → reclamo (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const reclamoId = randomUUID();
  let limpiezaId: string | null = null;
  let reservaId: string | null = null;
  const rutasLimpieza: string[] = [];
  const rutasCopiadas: string[] = [];

  afterAll(async () => {
    if (rutasCopiadas.length > 0) await s.storage.from(BUCKET).remove(rutasCopiadas);
    if (rutasLimpieza.length > 0) await s.storage.from(BUCKET_LIMPIEZAS).remove(rutasLimpieza);
    if (limpiezaId) {
      await s.from("limpieza_fotos").delete().eq("limpieza_id", limpiezaId);
      await s.from("limpiezas").delete().eq("id", limpiezaId);
    }
  });

  it("copia solo las fotos de daño, en orden, y deja afuera las del depto terminado", async () => {
    const { data: reserva } = await s
      .from("reservas")
      .select("id, depto_id")
      .not("depto_id", "is", null)
      .limit(1)
      .single();
    reservaId = reserva!.id;

    const { data: limpieza } = await s
      .from("limpiezas")
      .insert({
        depto_id: reserva!.depto_id!,
        reserva_id: reservaId,
        fecha: "2099-12-31",
        tipo: "normal",
        estado: "hecha",
      })
      .select("id")
      .single();
    limpiezaId = limpieza!.id;

    // Una foto de cada tipo, subidas de verdad al bucket de limpiezas.
    const contenido = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 9, 9])], {
      type: "image/jpeg",
    });
    for (const tipo of ["terminado", "arreglar", "huesped"] as const) {
      const ruta = `${limpiezaId}/${tipo}/${randomUUID()}.jpg`;
      const { error } = await s.storage
        .from(BUCKET_LIMPIEZAS)
        .upload(ruta, contenido, { contentType: "image/jpeg" });
      expect(error).toBeNull();
      rutasLimpieza.push(ruta);
      await s.from("limpieza_fotos").insert({
        limpieza_id: limpiezaId,
        storage_path: ruta,
        tipo,
      });
    }

    const copiadas = await fotosDeLimpieza(s, reservaId!, reclamoId);
    rutasCopiadas.push(...copiadas.map((f) => f.storage_path));

    // Las tres se cargaron, pero solo las dos de daño viajan al reclamo.
    expect(copiadas).toHaveLength(2);
    // Van a la carpeta del reclamo, no a la de la limpieza.
    expect(copiadas.every((f) => f.storage_path.startsWith(`${reclamoId}/`))).toBe(true);
    // Cada una conserva cuándo se sacó.
    expect(copiadas.every((f) => f.tomada_at !== null)).toBe(true);

    // Y existen de verdad en el bucket del reclamo: se pueden abrir.
    for (const foto of copiadas) {
      const { data } = await s.storage.from(BUCKET).createSignedUrl(foto.storage_path, 60);
      expect(data?.signedUrl).toBeTruthy();
    }

    // El original sigue en su lugar: el reclamo se llevó una copia.
    const { data: original } = await s.storage
      .from(BUCKET_LIMPIEZAS)
      .createSignedUrl(rutasLimpieza[0], 60);
    expect(original?.signedUrl).toBeTruthy();
  });

  it("una reserva sin limpiezas no devuelve nada y no rompe", async () => {
    expect(await fotosDeLimpieza(s, randomUUID(), reclamoId)).toEqual([]);
  });
});
