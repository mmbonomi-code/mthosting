/**
 * Control de salud de las limpiezas cargadas. NO escribe nada.
 *
 * Comprueba las dos cosas que tienen que ser ciertas siempre, mirando los
 * datos de verdad en vez de un escenario armado:
 *
 *   1. Ningún repaso vivo cuelga de una reserva que tuvo una salida antes.
 *      El repaso existe para el huésped que entra a un departamento sin
 *      limpieza previa; si hubo una salida, la limpieza de salida ya lo cubrió.
 *
 *   2. Ningún departamento tiene dos limpiezas vivas el mismo día.
 *
 * Por qué de verdad hace falta: los dos se rompieron el 14/08/2026 y ninguna
 * prueba unitaria lo vio, porque la causa no estaba en la regla sino en los
 * datos que le llegaban. La consulta que armaba el contexto no paginaba, la
 * base cortaba en mil filas sin avisar, y el planificador decidía con un
 * historial incompleto.
 *
 * Toda consulta de acá pagina a propósito. Un control que se miente solo es
 * peor que no tenerlo.
 */
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TANDA = 1000;

describe.skipIf(!url || !clave)("limpiezas cargadas (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

  /** Trae todo de a tandas. Sin esto, la base corta en mil y no avisa. */
  async function todo<T>(
    consulta: (a: number, b: number) => PromiseLike<{ data: T[] | null }>,
  ): Promise<T[]> {
    const filas: T[] = [];
    for (let d = 0; ; d += TANDA) {
      const { data } = await consulta(d, d + TANDA - 1);
      const tanda = data ?? [];
      filas.push(...tanda);
      if (tanda.length < TANDA) return filas;
    }
  }

  it("ningún repaso cuelga de una reserva que ya tuvo una salida antes", async () => {
    const { data: deptos } = await s.from("departamentos").select("id, codigo");
    const codigo = new Map((deptos ?? []).map((d) => [d.id, d.codigo]));

    const reservas = await todo<{
      depto_id: string | null;
      fecha_checkout: string | null;
      cancelada: boolean;
      descartada: boolean;
    }>((a, b) =>
      s
        .from("reservas")
        .select("depto_id, fecha_checkout, cancelada, descartada")
        .eq("cancelada", false)
        .eq("descartada", false)
        .not("depto_id", "is", null)
        .order("id")
        .range(a, b),
    );

    // La última salida de cada departamento hasta cada fecha, resuelto con un
    // solo recorrido: nada de una consulta por limpieza.
    const salidasPorDepto = new Map<string, string[]>();
    for (const r of reservas) {
      if (!r.fecha_checkout) continue;
      const lista = salidasPorDepto.get(r.depto_id!) ?? [];
      lista.push(r.fecha_checkout);
      salidasPorDepto.set(r.depto_id!, lista);
    }

    const repasos = await todo<{
      fecha: string;
      depto_id: string;
      reserva: { codigo_reserva: string; fecha_checkin: string | null } | null;
    }>((a, b) =>
      s
        .from("limpiezas")
        .select("fecha, depto_id, reserva:reservas(codigo_reserva, fecha_checkin)")
        .eq("tipo", "repaso")
        .neq("estado", "cancelada")
        .order("id")
        .range(a, b),
    );

    const sobran = repasos.filter((l) => {
      const entra = l.reserva?.fecha_checkin;
      if (!entra) return false;
      return (salidasPorDepto.get(l.depto_id) ?? []).some((salida) => salida <= entra);
    });

    for (const l of sobran) {
      console.log(
        `sobra: ${l.fecha} ${codigo.get(l.depto_id)} ${l.reserva?.codigo_reserva}`,
      );
    }
    console.log(`repasos vivos: ${repasos.length} · de más: ${sobran.length}`);
    expect(sobran).toHaveLength(0);
  }, 300000);

  it("ningún departamento tiene dos limpiezas el mismo día", async () => {
    const { data: deptos } = await s.from("departamentos").select("id, codigo");
    const codigo = new Map((deptos ?? []).map((d) => [d.id, d.codigo]));

    const vivas = await todo<{ depto_id: string; fecha: string }>((a, b) =>
      s
        .from("limpiezas")
        .select("depto_id, fecha")
        .neq("estado", "cancelada")
        .order("id")
        .range(a, b),
    );

    const porDia = new Map<string, number>();
    for (const l of vivas) {
      const clave = `${l.depto_id}|${l.fecha}`;
      porDia.set(clave, (porDia.get(clave) ?? 0) + 1);
    }

    const repetidos = [...porDia].filter(([, n]) => n > 1);
    for (const [k, n] of repetidos) {
      const [d, f] = k.split("|");
      console.log(`repetido: ${codigo.get(d)} ${f} tiene ${n}`);
    }
    console.log(`limpiezas vivas: ${vivas.length} · días repetidos: ${repetidos.length}`);
    expect(repetidos).toHaveLength(0);
  }, 300000);
});
