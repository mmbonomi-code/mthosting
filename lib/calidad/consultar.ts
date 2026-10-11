/**
 * Lee de la base lo que necesita la pantalla de Calidad y lo resume
 * (lib/calidad/resumen.ts). Todo con el cliente de quien mira: RLS deja
 * pasar solo a manager y administración.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { CATEGORIAS, type Categoria } from "./parser";
import { ventanaTasa, type Periodo } from "./periodo";
import { resumirCalidad, type Estadia, type Queja, type ResenaResumen, type ResumenCalidad } from "./resumen";
import { armarRanking, LIMPIEZA_BAJA, type Ranking } from "./ranking";

type Cliente = SupabaseClient<Database>;

/** Lee todas las páginas de una consulta (PostgREST corta en 1000). */
async function todas<T>(
  consulta: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await consulta(desde, desde + 999);
    if (error) throw new Error(error.message);
    filas.push(...(data ?? []));
    if (!data || data.length < 1000) return filas;
  }
}

export async function consultarCalidad(
  supabase: Cliente,
  periodo: Periodo,
  hoy: string,
): Promise<ResumenCalidad & { ventanaTasa: { desde: string; hasta: string } | null }> {
  const ventana = ventanaTasa(periodo, hoy);

  const [resenas, quejas, revisadas, estadias, deptos] = await Promise.all([
    todas((a, b) =>
      supabase
        .from("resenas")
        .select(
          "id, depto_id, reserva_id, puntaje_general, puntaje_limpieza, puntaje_veracidad, puntaje_checkin, puntaje_comunicacion, puntaje_ubicacion, puntaje_precio",
        )
        .eq("activo", true)
        .gte("fecha_checkout", periodo.desde)
        .lte("fecha_checkout", periodo.hasta)
        .order("id")
        .range(a, b),
    ),
    // Las quejas de las reseñas del período, en una sola consulta: el filtro
    // va sobre la reseña con un join interno.
    todas((a, b) =>
      supabase
        .from("resena_etiquetas")
        .select("resena_id, categoria, texto, resenas!inner(fecha_checkout, activo)")
        .eq("signo", "negativa")
        .eq("resenas.activo", true)
        .gte("resenas.fecha_checkout", periodo.desde)
        .lte("resenas.fecha_checkout", periodo.hasta)
        .order("id")
        .range(a, b),
    ),
    todas((a, b) => supabase.from("resena_revisada").select("resena_id, firma").order("id").range(a, b)),
    ventana
      ? todas((a, b) =>
          supabase
            .from("reservas")
            .select("id, depto_id")
            .not("depto_id", "is", null)
            .eq("cancelada", false)
            .eq("descartada", false)
            .gte("fecha_checkout", ventana.desde)
            .lte("fecha_checkout", ventana.hasta)
            .order("id")
            .range(a, b),
        )
      : Promise.resolve([]),
    todas((a, b) => supabase.from("departamentos").select("id, codigo").order("id").range(a, b)),
  ]);

  const resumen = resumirCalidad({
    resenas: resenas.map(
      (r): ResenaResumen => ({
        id: r.id,
        depto_id: r.depto_id,
        reserva_id: r.reserva_id,
        puntaje_general: r.puntaje_general,
        puntajes: Object.fromEntries(
          CATEGORIAS.map((c) => [c, r[`puntaje_${c}` as const]]),
        ) as Record<Categoria, number | null>,
      }),
    ),
    quejas: quejas.map((q): Queja => ({ resena_id: q.resena_id, categoria: q.categoria, texto: q.texto })),
    revisadas: new Map(revisadas.map((r) => [r.resena_id, r.firma])),
    estadias: estadias.map((e): Estadia => ({ id: e.id, depto_id: e.depto_id! })),
    deptos,
  });

  return { ...resumen, ventanaTasa: ventana };
}

/** Una reseña que le baja el puntaje a alguien: se lista debajo de su fila. */
export type ResenaFloja = {
  id: string;
  depto: string;
  fecha_checkin: string;
  fecha_checkout: string;
  limpieza_fecha: string | null;
  origen: "sistema" | "listado";
  puntaje_general: number;
  puntaje_limpieza: number | null;
  quejas: string[];
  comentario_privado: string | null;
};

/**
 * El ranking de limpieza del período, y para cada persona las reseñas que le
 * bajan el puntaje (limpieza de 3 o menos, o con queja de limpieza), de la más
 * reciente a la más vieja.
 */
export async function consultarRanking(
  supabase: Cliente,
  periodo: Periodo,
): Promise<Ranking & { flojas: Map<string, ResenaFloja[]> }> {
  const [resenas, quejas, personas, deptos] = await Promise.all([
    todas((a, b) =>
      supabase
        .from("resenas_atribuidas")
        .select(
          "id, depto_id, fecha_checkin, fecha_checkout, limpieza_fecha, responsable_id, origen_responsable, puntaje_general, puntaje_limpieza, comentario_privado",
        )
        .eq("activo", true)
        .gte("fecha_checkout", periodo.desde)
        .lte("fecha_checkout", periodo.hasta)
        .order("id")
        .range(a, b),
    ),
    todas((a, b) =>
      supabase
        .from("resena_etiquetas")
        .select("resena_id, texto, resenas!inner(fecha_checkout, activo)")
        .eq("signo", "negativa")
        .eq("categoria", "limpieza")
        .eq("resenas.activo", true)
        .gte("resenas.fecha_checkout", periodo.desde)
        .lte("resenas.fecha_checkout", periodo.hasta)
        .order("id")
        .range(a, b),
    ),
    todas((a, b) => supabase.from("personas").select("id, nombre").order("id").range(a, b)),
    todas((a, b) => supabase.from("departamentos").select("id, codigo").order("id").range(a, b)),
  ]);

  const quejasDe = new Map<string, string[]>();
  for (const q of quejas) quejasDe.set(q.resena_id, [...(quejasDe.get(q.resena_id) ?? []), q.texto]);
  const codigoDe = new Map(deptos.map((d) => [d.id, d.codigo]));

  const ranking = armarRanking(
    resenas.map((r) => ({
      id: r.id!,
      responsable_id: r.responsable_id,
      puntaje_limpieza: r.puntaje_limpieza,
      quejasLimpieza: quejasDe.get(r.id!) ?? [],
    })),
    personas,
  );

  const flojas = new Map<string, ResenaFloja[]>();
  for (const r of resenas) {
    if (!r.responsable_id) continue;
    const propias = quejasDe.get(r.id!) ?? [];
    const baja = r.puntaje_limpieza !== null && r.puntaje_limpieza <= LIMPIEZA_BAJA;
    if (!baja && propias.length === 0) continue;
    flojas.set(r.responsable_id, [
      ...(flojas.get(r.responsable_id) ?? []),
      {
        id: r.id!,
        depto: (r.depto_id && codigoDe.get(r.depto_id)) || "—",
        fecha_checkin: r.fecha_checkin!,
        fecha_checkout: r.fecha_checkout!,
        limpieza_fecha: r.limpieza_fecha,
        origen: r.origen_responsable === "sistema" ? "sistema" : "listado",
        puntaje_general: r.puntaje_general!,
        puntaje_limpieza: r.puntaje_limpieza,
        quejas: propias,
        comentario_privado: r.comentario_privado,
      },
    ]);
  }
  for (const lista of flojas.values()) lista.sort((x, y) => y.fecha_checkin.localeCompare(x.fecha_checkin));

  return { ...ranking, flojas };
}
