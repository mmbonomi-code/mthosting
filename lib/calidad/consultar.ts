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
