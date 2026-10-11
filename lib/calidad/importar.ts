/**
 * Importación del Excel de reseñas (docs/CALIDAD-ESPECIFICACION.md §5.5).
 *
 * Dos pasos, y el primero no escribe nada:
 *
 *   1. `analizarResenas`: lee el archivo, lo cruza con la base y devuelve
 *      cuántas son nuevas, cuántas cambian, qué anuncios no se reconocen y
 *      cuántas alertas va a generar. Es la previa que ve la persona.
 *   2. `aplicarResenas`: vuelve a analizar el MISMO archivo (no confía en lo
 *      que mandó el navegador) y escribe.
 *
 * Volver a subir un archivo ya cargado no duplica: la clave es el ID de la
 * reseña de Airbnb, y una reseña sin cambios no se toca.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { motivoAlerta } from "./alertas";
import { aFila, elegirReserva, fusionar, type ReservaCandidata } from "./cruce";
import {
  CATEGORIAS,
  parsearResenas,
  type Etiqueta,
  type FilaRechazada,
  type ResenaParseada,
} from "./parser";

type Cliente = SupabaseClient<Database>;
type InsertResena = Database["public"]["Tables"]["resenas"]["Insert"];
type InsertEtiqueta = Database["public"]["Tables"]["resena_etiquetas"]["Insert"];

/** Anuncio → departamento elegido a mano en la previa. */
export type Vinculos = Record<string, string>;

export type AnuncioSinVincular = {
  airbnb_listing_id: string;
  anuncio: string | null;
  resenas: number;
};

export type Previa = {
  archivo: string;
  hash: string;
  /** Si este mismo archivo ya se confirmó antes, cuándo. */
  yaCargadoEl: string | null;
  filasLeidas: number;
  rechazadas: FilaRechazada[];
  nuevas: number;
  actualizadas: number;
  sinCambios: number;
  conReserva: number;
  sinReserva: number;
  anunciosSinVincular: AnuncioSinVincular[];
  /** Reseñas del archivo que cumplen la regla de alerta (§3.7). */
  conAlerta: number;
  desde: string | null;
  hasta: string | null;
};

type Plan = {
  previa: Previa;
  /** Solo las nuevas y las que cambian. */
  escribir: InsertResena[];
  /** Por ID de reseña de Airbnb: todas las del archivo que traen etiquetas. */
  etiquetas: Map<string, Etiqueta[]>;
  /** Ids ya existentes, por ID de reseña de Airbnb. */
  idsExistentes: Map<string, string>;
  /** Departamentos a los que hay que escribirles el número de anuncio. */
  vincular: { deptoId: string; listingId: string }[];
};

/** Tanda de escritura y de `in (...)`: entra en una URL y en el tiempo. */
const TANDA = 200;

function enTandas<T>(lista: T[], tamano = TANDA): T[][] {
  const tandas: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) tandas.push(lista.slice(i, i + tamano));
  return tandas;
}

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

function negativas(r: ResenaParseada): string[] {
  return CATEGORIAS.flatMap((c) =>
    (r.etiquetas[c] ?? []).filter((e) => e.signo === "negativa").map((e) => e.texto),
  );
}

async function armarPlan(
  supabase: Cliente,
  archivo: { nombre: string; filas: string[][]; bytes: ArrayBuffer },
  vinculos: Vinculos,
): Promise<Plan> {
  const { resenas, rechazadas } = parsearResenas(archivo.filas);
  const hash = createHash("sha256").update(Buffer.from(archivo.bytes)).digest("hex");

  // ---- Anuncio → departamento --------------------------------------------
  const { data: deptos, error: errDeptos } = await supabase
    .from("departamentos")
    .select("id, airbnb_listing_id")
    .not("airbnb_listing_id", "is", null);
  if (errDeptos) throw new Error(errDeptos.message);

  const deptoDe = new Map<string, string>();
  for (const d of deptos ?? []) deptoDe.set(d.airbnb_listing_id!, d.id);
  const deptoConAnuncio = new Set((deptos ?? []).map((d) => d.id));

  const vincular: Plan["vincular"] = [];
  for (const [listingId, deptoId] of Object.entries(vinculos)) {
    if (!deptoId || deptoDe.has(listingId)) continue;
    if (deptoConAnuncio.has(deptoId)) {
      throw new Error(
        `El departamento elegido para el anuncio ${listingId} ya tiene otro anuncio de Airbnb vinculado.`,
      );
    }
    deptoDe.set(listingId, deptoId);
    deptoConAnuncio.add(deptoId);
    vincular.push({ deptoId, listingId });
  }

  const sinVincular = new Map<string, AnuncioSinVincular>();
  for (const r of resenas) {
    if (deptoDe.has(r.airbnb_listing_id)) continue;
    const a = sinVincular.get(r.airbnb_listing_id) ?? {
      airbnb_listing_id: r.airbnb_listing_id,
      anuncio: r.anuncio_raw,
      resenas: 0,
    };
    a.resenas++;
    sinVincular.set(r.airbnb_listing_id, a);
  }

  // ---- Reservas candidatas: sin canceladas ni descartadas (§3.3) ----------
  const fechas = resenas.map((r) => r.fecha_checkin).sort();
  const desde = fechas[0] ?? null;
  const hasta = fechas.at(-1) ?? null;
  const deptoIds = [...new Set(resenas.map((r) => deptoDe.get(r.airbnb_listing_id)).filter(Boolean))] as string[];

  const candidatas: ReservaCandidata[] =
    desde && hasta && deptoIds.length > 0
      ? await todas((a, b) =>
          supabase
            .from("reservas")
            .select("id, depto_id, fecha_checkin, fecha_checkout, huesped_nombre")
            .in("depto_id", deptoIds)
            .gte("fecha_checkin", desde)
            .lte("fecha_checkin", hasta)
            .eq("cancelada", false)
            .eq("descartada", false)
            .order("id")
            .range(a, b),
        )
      : [];
  const porDepto = new Map<string, ReservaCandidata[]>();
  for (const c of candidatas) {
    const lista = porDepto.get(c.depto_id!) ?? [];
    lista.push(c);
    porDepto.set(c.depto_id!, lista);
  }

  // ---- Lo que ya está cargado --------------------------------------------
  const existentes = new Map<string, Database["public"]["Tables"]["resenas"]["Row"]>();
  for (const tanda of enTandas(resenas.map((r) => r.airbnb_resena_id))) {
    const { data, error } = await supabase.from("resenas").select("*").in("airbnb_resena_id", tanda);
    if (error) throw new Error(error.message);
    for (const e of data ?? []) existentes.set(e.airbnb_resena_id, e);
  }

  // ---- Cada reseña --------------------------------------------------------
  const escribir: InsertResena[] = [];
  const etiquetas = new Map<string, Etiqueta[]>();
  let nuevas = 0;
  let actualizadas = 0;
  let sinCambios = 0;
  let conReserva = 0;
  let conAlerta = 0;

  for (const r of resenas) {
    const deptoId = deptoDe.get(r.airbnb_listing_id) ?? null;
    const reserva = deptoId ? elegirReserva(r, deptoId, porDepto.get(deptoId) ?? []) : null;
    const existente = existentes.get(r.airbnb_resena_id) ?? null;
    const { fila, cambia } = fusionar(existente, aFila(r, deptoId, reserva?.id ?? null));

    if (fila.reserva_id) conReserva++;
    if (motivoAlerta({ puntaje_general: r.puntaje_general, puntajes: r.puntajes, negativas: negativas(r) })) {
      conAlerta++;
    }

    if (!existente) nuevas++;
    else if (cambia) actualizadas++;
    else sinCambios++;
    if (cambia) escribir.push(fila as InsertResena);

    const todasLasEtiquetas = CATEGORIAS.flatMap((c) => r.etiquetas[c] ?? []);
    if (todasLasEtiquetas.length > 0) etiquetas.set(r.airbnb_resena_id, todasLasEtiquetas);
  }

  // ---- ¿Este archivo ya se cargó? ----------------------------------------
  const { data: previo } = await supabase
    .from("importaciones_resenas")
    .select("created_at")
    .eq("archivo_hash", hash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    previa: {
      archivo: archivo.nombre,
      hash,
      yaCargadoEl: previo?.created_at ?? null,
      filasLeidas: resenas.length + rechazadas.length,
      rechazadas,
      nuevas,
      actualizadas,
      sinCambios,
      conReserva,
      sinReserva: resenas.length - conReserva,
      anunciosSinVincular: [...sinVincular.values()],
      conAlerta,
      desde,
      hasta,
    },
    escribir,
    etiquetas,
    idsExistentes: new Map([...existentes.values()].map((e) => [e.airbnb_resena_id, e.id])),
    vincular,
  };
}

/** La previa: lee y cruza, no escribe nada. */
export async function analizarResenas(
  supabase: Cliente,
  archivo: { nombre: string; filas: string[][]; bytes: ArrayBuffer },
  vinculos: Vinculos = {},
): Promise<Previa> {
  return (await armarPlan(supabase, archivo, vinculos)).previa;
}

/** Confirmar: vuelve a analizar el mismo archivo y escribe. */
export async function aplicarResenas(
  supabase: Cliente,
  archivo: { nombre: string; filas: string[][]; bytes: ArrayBuffer },
  vinculos: Vinculos,
  usuarioId: string | null,
): Promise<Previa> {
  const plan = await armarPlan(supabase, archivo, vinculos);
  const { previa } = plan;

  // 1. Los anuncios vinculados a mano quedan en su departamento, para la
  //    próxima carga y para todo lo demás que use el número de anuncio.
  for (const v of plan.vincular) {
    const { error } = await supabase
      .from("departamentos")
      .update({ airbnb_listing_id: v.listingId })
      .eq("id", v.deptoId)
      .is("airbnb_listing_id", null);
    if (error) throw new Error(`No se pudo vincular el anuncio ${v.listingId}: ${error.message}`);
  }

  // 2. El registro de la carga, que firma las filas que se escriben.
  const { data: carga, error: errCarga } = await supabase
    .from("importaciones_resenas")
    .insert({
      usuario_id: usuarioId,
      archivo_nombre: previa.archivo,
      archivo_hash: previa.hash,
      filas_leidas: previa.filasLeidas,
      nuevas: previa.nuevas,
      actualizadas: previa.actualizadas,
      sin_cambios: previa.sinCambios,
      sin_depto: previa.anunciosSinVincular.reduce((n, a) => n + a.resenas, 0),
      sin_reserva: previa.sinReserva,
      avisos: previa.rechazadas,
    })
    .select("id")
    .single();
  if (errCarga) throw new Error(errCarga.message);

  // 3. Las reseñas nuevas y las que cambiaron.
  const ids = new Map(plan.idsExistentes);
  for (const tanda of enTandas(plan.escribir)) {
    const { data, error } = await supabase
      .from("resenas")
      .upsert(
        tanda.map((f) => ({ ...f, import_id: carga.id })),
        { onConflict: "airbnb_resena_id" },
      )
      .select("id, airbnb_resena_id");
    if (error) throw new Error(error.message);
    for (const f of data ?? []) ids.set(f.airbnb_resena_id, f.id);
  }

  // 4. Las etiquetas. Solo se agregan: una que ya estaba no se duplica y
  //    ninguna se borra (Airbnb no cambia las etiquetas de una reseña).
  const filasEtiqueta: InsertEtiqueta[] = [];
  for (const [resenaAirbnb, lista] of plan.etiquetas) {
    const resenaId = ids.get(resenaAirbnb);
    if (!resenaId) continue;
    for (const e of lista) {
      filasEtiqueta.push({ resena_id: resenaId, categoria: e.categoria, signo: e.signo, texto: e.texto });
    }
  }
  for (const tanda of enTandas(filasEtiqueta, 500)) {
    const { error } = await supabase
      .from("resena_etiquetas")
      .upsert(tanda, { onConflict: "resena_id,categoria,texto", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  return previa;
}
