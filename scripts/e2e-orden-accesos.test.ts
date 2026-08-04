/**
 * Verifica contra la base DEV que el orden de los puntos de acceso se
 * pueda cambiar y que la coordinación los ofrezca en ese orden.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("orden de los puntos de acceso (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const creados: string[] = [];

  afterAll(async () => {
    for (const id of creados) await s.from("puntos_acceso").delete().eq("id", id);
  });

  it("las flechas cambian el orden en que se ofrecen al coordinar", async () => {
    for (const [i, ubicacion] of ["PRUEBA A", "PRUEBA B", "PRUEBA C"].entries()) {
      const { data } = await s
        .from("puntos_acceso")
        .insert({ metodo: "sobre", ubicacion, orden: (i + 1) * 1000, activo: true })
        .select("id")
        .single();
      creados.push(data!.id);
    }

    const leer = async () => {
      const { data } = await s
        .from("puntos_acceso")
        .select("id, ubicacion, orden")
        .in("id", creados)
        .order("orden")
        .order("ubicacion");
      return (data ?? []).map((p) => p.ubicacion);
    };

    expect(await leer()).toEqual(["PRUEBA A", "PRUEBA B", "PRUEBA C"]);

    // Lo mismo que hace la acción de subir: intercambia y renumera.
    const { data: puntos } = await s
      .from("puntos_acceso")
      .select("id, orden")
      .in("id", creados)
      .order("orden")
      .order("ubicacion");
    const lista = [...puntos!];
    [lista[1], lista[2]] = [lista[2], lista[1]]; // sube el tercero
    await Promise.all(
      lista.map((p, i) =>
        s.from("puntos_acceso").update({ orden: (i + 1) * 10 }).eq("id", p.id),
      ),
    );

    const despues = await leer();
    console.log("orden después de subir el tercero:", despues.join(" → "));
    expect(despues).toEqual(["PRUEBA A", "PRUEBA C", "PRUEBA B"]);
  });
});
