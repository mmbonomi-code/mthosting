/**
 * Sincronización del calendario iCal de Airbnb (spec §2.12).
 *
 * Desde que Airbnb sacó la exportación del archivo de reservas (13/09/2026),
 * el calendario es la única fuente automática. Hace dos cosas:
 *
 *  1. DESCUBRE reservas nuevas, como siempre:
 *     - Si la reserva ya existe (venga de donde venga), sus datos NO se tocan.
 *     - Si no existe, se crea con `origen = ical` y `datos_completos = false`,
 *       y se le genera su limpieza tentativa: vale más una limpieza de más,
 *       fácil de cancelar, que una reserva que nadie vio venir.
 *     - Un evento sin código legible se saltea y se informa. Nunca se crea una
 *       reserva sin código.
 *     - Los bloqueos del calendario van a `bloqueos`, no a `reservas`.
 *
 *  2. COMPARA con lo que ya está (lib/ical/cambios.ts), solo en la
 *     sincronización completa: con un calendario solo, una reserva que se
 *     mudó a otro departamento parecería cancelada.
 *     - Posibles cancelaciones y cambios de departamento: se MARCAN, y la
 *       reserva no se toca hasta que una persona confirma desde Alertas.
 *     - Cambios de fecha: se APLICAN, con su limpieza (decisión del dueño,
 *       16/09/2026). Es el mismo código de reserva con otras fechas: no hay
 *       nada que inferir.
 *
 * Cada corrida queda registrada en `sincronizaciones_ical`, para que lo que
 * no se pudo leer o lo que se frenó no pase en silencio de madrugada.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { parsearICal } from "./parser";
import {
  planificarCambios,
  type MarcaExistente,
  type ReservaComparable,
  type Retenida,
  type VistoEnCalendario,
} from "./cambios";
import { generarLimpiezas } from "../limpiezas/generar";
import { calcularNoches } from "../reservas/validar";
import { reservasVecinas } from "./confirmar";
import { hoyAR } from "../fechas";

type Cliente = SupabaseClient<Database>;

export type ResumenSync = {
  departamentos: number;
  reservasNuevas: number;
  reservasExistentes: number;
  bloqueosNuevos: number;
  limpiezasGeneradas: number;
  posiblesCancelaciones: number;
  /** Cambios de fecha que se aplicaron solos (no pasan por Alertas). */
  cambiosFechas: number;
  cambiosDepto: number;
  /** Posibles cancelaciones que el freno de desaparición masiva no marcó. */
  retenidas: number;
  /** Marcas pendientes que se cerraron porque la reserva volvió a coincidir. */
  resueltasSolas: number;
  avisos: string[];
};

/** Cuántos calendarios se piden a Airbnb al mismo tiempo. */
const EN_PARALELO = 6;

/** Lee el calendario de un departamento. Devuelve el texto o el error. */
async function bajarCalendario(url: string): Promise<{ texto?: string; error?: string }> {
  try {
    const respuesta = await fetch(url, {
      headers: { "User-Agent": "MTHosting/1.0" },
      cache: "no-store",
    });
    if (!respuesta.ok) {
      return { error: `respondió ${respuesta.status}` };
    }
    const texto = await respuesta.text();
    // Un calendario cortado a la mitad "no trae" las reservas del final, y eso
    // se leería como cancelaciones. Si no está entero, no se lee.
    if (!texto.includes("BEGIN:VCALENDAR") || !texto.includes("END:VCALENDAR")) {
      return { error: "la respuesta no es un calendario completo" };
    }
    return { texto };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "no se pudo leer" };
  }
}

/** La base devuelve como máximo mil filas y no avisa cuando corta. */
async function traerTodo<T>(
  armarConsulta: (desde: number, hasta: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>,
  queCosa: string,
): Promise<T[]> {
  const filas: T[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await armarConsulta(desde, desde + 999);
    if (error) throw new Error(`No se pudo leer ${queCosa}: ${error.message}`);
    filas.push(...(data ?? []));
    if ((data ?? []).length < 1000) return filas;
  }
}

export async function sincronizarICal(
  supabase: Cliente,
  /** Un departamento puntual, o todos los que tengan calendario cargado. */
  deptoId?: string,
): Promise<ResumenSync> {
  const resumen: ResumenSync = {
    departamentos: 0,
    reservasNuevas: 0,
    reservasExistentes: 0,
    bloqueosNuevos: 0,
    limpiezasGeneradas: 0,
    posiblesCancelaciones: 0,
    cambiosFechas: 0,
    cambiosDepto: 0,
    retenidas: 0,
    resueltasSolas: 0,
    avisos: [],
  };
  const hoy = hoyAR();
  const completa = !deptoId;

  let consulta = supabase
    .from("departamentos")
    .select("id, codigo, ical_url")
    .not("ical_url", "is", null)
    .eq("activo", true)
    .order("codigo");
  if (deptoId) consulta = consulta.eq("id", deptoId);

  const { data: deptos, error } = await consulta;
  if (error) throw new Error(`No se pudieron leer los departamentos: ${error.message}`);
  if (!deptos || deptos.length === 0) return resumen;

  // --- 1. Leer todos los calendarios ---
  const lecturas: { depto: (typeof deptos)[number]; texto?: string; error?: string }[] = [];
  for (let i = 0; i < deptos.length; i += EN_PARALELO) {
    const tanda = deptos.slice(i, i + EN_PARALELO);
    const leidas = await Promise.all(tanda.map((d) => bajarCalendario(d.ical_url!)));
    tanda.forEach((depto, j) => lecturas.push({ depto, ...leidas[j] }));
  }

  const fallidos: { depto_id: string; error: string }[] = [];
  const leidos: { depto: (typeof deptos)[number]; parseado: ReturnType<typeof parsearICal> }[] = [];
  for (const { depto, texto, error: errorBajada } of lecturas) {
    resumen.departamentos++;
    if (!texto) {
      resumen.avisos.push(`${depto.codigo}: no se pudo leer el calendario (${errorBajada}).`);
      fallidos.push({ depto_id: depto.id, error: errorBajada ?? "no se pudo leer" });
      continue;
    }
    const parseado = parsearICal(texto);
    for (const motivo of parseado.salteados) resumen.avisos.push(`${depto.codigo}: ${motivo}`);
    leidos.push({ depto, parseado });
  }

  const vistos: VistoEnCalendario[] = leidos.flatMap(({ depto, parseado }) =>
    parseado.reservas.map((r) => ({
      codigo: r.codigo!,
      depto_id: depto.id,
      desde: r.desde,
      hasta: r.hasta,
    })),
  );

  // --- 2. Reservas nuevas ---
  const codigosVistos = [...new Set(vistos.map((v) => v.codigo))];
  const yaEstan = new Map<string, { cancelada: boolean }>();
  for (let i = 0; i < codigosVistos.length; i += 200) {
    const { data, error: errorExistentes } = await supabase
      .from("reservas")
      .select("codigo_reserva, cancelada")
      .in("codigo_reserva", codigosVistos.slice(i, i + 200));
    if (errorExistentes) {
      throw new Error(`No se pudieron leer las reservas existentes: ${errorExistentes.message}`);
    }
    for (const r of data ?? []) yaEstan.set(r.codigo_reserva, { cancelada: r.cancelada });
  }

  const codigosNuevos: string[] = [];
  for (const { depto, parseado } of leidos) {
    const aCrear = parseado.reservas.filter(
      (r) => !yaEstan.has(r.codigo!) && !codigosNuevos.includes(r.codigo!),
    );
    resumen.reservasExistentes += parseado.reservas.length - aCrear.length;

    // Cancelada es terminal (§2.5): si Airbnb la sigue mostrando, alguien se
    // equivocó al confirmar, o Airbnb la reactivó. No se revierte sola.
    for (const r of parseado.reservas) {
      if (yaEstan.get(r.codigo!)?.cancelada && r.hasta >= hoy) {
        resumen.avisos.push(
          `${depto.codigo}: ${r.codigo} figura cancelada acá, pero Airbnb la sigue mostrando del ${r.desde} al ${r.hasta}. Revisala en Airbnb.`,
        );
      }
    }

    if (aCrear.length === 0) continue;
    const { error: errorInsert } = await supabase.from("reservas").insert(
      aCrear.map((r) => ({
        codigo_reserva: r.codigo!,
        canal: "airbnb" as const,
        origen: "ical" as const,
        // Tentativa: sin teléfono no se puede coordinar el check-in.
        datos_completos: false,
        depto_id: depto.id,
        fecha_checkin: r.desde,
        fecha_checkout: r.hasta,
        // Los 4 dígitos ayudan a identificar al huésped, pero no se usan
        // para cruzar ni validar: el cruce es siempre por código.
        raw: { origen: "ical", telefono_ultimos_4: r.telefono4 },
      })),
    );
    if (errorInsert) {
      resumen.avisos.push(`${depto.codigo}: no se pudieron crear las reservas (${errorInsert.message}).`);
    } else {
      resumen.reservasNuevas += aCrear.length;
      codigosNuevos.push(...aCrear.map((r) => r.codigo!));
    }
  }

  // --- 3. Bloqueos del calendario ---
  const idsLeidos = leidos.map((l) => l.depto.id);
  const bloqueosExistentes = new Set<string>();
  if (idsLeidos.length > 0) {
    const filas = await traerTodo(
      (a, b) =>
        supabase
          .from("bloqueos")
          .select("depto_id, fecha_desde, fecha_hasta")
          .in("depto_id", idsLeidos)
          .order("id")
          .range(a, b),
      "los bloqueos",
    );
    for (const b of filas) bloqueosExistentes.add(`${b.depto_id}|${b.fecha_desde}|${b.fecha_hasta}`);
  }
  const bloqueosACrear = leidos.flatMap(({ depto, parseado }) =>
    parseado.bloqueos
      .filter((b) => !bloqueosExistentes.has(`${depto.id}|${b.desde}|${b.hasta}`))
      .map((b) => ({
        depto_id: depto.id,
        fecha_desde: b.desde,
        fecha_hasta: b.hasta,
        motivo: "otro" as const,
        notas: "Bloqueo del calendario de Airbnb",
      })),
  );
  if (bloqueosACrear.length > 0) {
    const { error: errorBloqueos } = await supabase.from("bloqueos").insert(bloqueosACrear);
    if (errorBloqueos) resumen.avisos.push(`No se pudieron guardar los bloqueos (${errorBloqueos.message}).`);
    else resumen.bloqueosNuevos = bloqueosACrear.length;
  }

  if (idsLeidos.length > 0) {
    await supabase
      .from("departamentos")
      .update({ ical_ultima_sync: new Date().toISOString() })
      .in("id", idsLeidos);
  }

  // Cada reserva descubierta se lleva su limpieza tentativa.
  if (codigosNuevos.length > 0) {
    const limpiezas = await generarLimpiezas(supabase, codigosNuevos, hoy);
    resumen.limpiezasGeneradas = limpiezas.generadas;
    resumen.avisos.push(...limpiezas.anomalias);
  }

  // --- 4. Lo que cambió en Airbnb ---
  let retenidas: Retenida[] = [];
  if (completa && idsLeidos.length > 0) {
    try {
      retenidas = await marcarCambios(supabase, idsLeidos, vistos, hoy, resumen);
    } catch (e) {
      // Lo descubierto ya quedó guardado: no se miente diciendo que falló todo.
      resumen.avisos.push(
        `No se pudieron revisar cancelaciones y cambios: ${e instanceof Error ? e.message : "error desconocido"}.`,
      );
    }
  }

  const { error: errorRegistro } = await supabase.from("sincronizaciones_ical").insert({
    completa,
    resumen,
    retenidas,
    fallidos,
  });
  if (errorRegistro) {
    resumen.avisos.push(`No se pudo registrar la sincronización (${errorRegistro.message}).`);
  }

  return resumen;
}

/**
 * Los cambios de fecha que trajo el calendario, aplicados: la reserva toma
 * las fechas nuevas y sus limpiezas (y las de las reservas vecinas del
 * departamento) se reacomodan con las reglas de siempre. Queda registrado en
 * `cambios_calendario` como confirmado, para saber qué se movió y cuándo.
 *
 * Una reserva que falla no frena a las demás: se avisa y se sigue.
 */
export async function aplicarFechas(
  supabase: Cliente,
  cambios: Awaited<ReturnType<typeof planificarCambios>>["fechasAAplicar"],
  hoy: string,
  resumen: ResumenSync,
): Promise<void> {
  if (cambios.length === 0) return;

  const codigos: string[] = [];
  const ahora = new Date().toISOString();

  for (const { pendiente_id, ...cambio } of cambios) {
    const desde = cambio.calendario_checkin!;
    const hasta = cambio.calendario_checkout!;

    const { data: reserva, error } = await supabase
      .from("reservas")
      .update({ fecha_checkin: desde, fecha_checkout: hasta, noches: calcularNoches(desde, hasta) })
      .eq("id", cambio.reserva_id)
      .select("id, codigo_reserva, depto_id")
      .single();
    if (error || !reserva) {
      resumen.avisos.push(`No se pudieron actualizar las fechas de una reserva (${error?.message ?? "no encontrada"}).`);
      continue;
    }

    const registro = { ...cambio, estado: "confirmado" as const, resuelto_at: ahora };
    const { error: errorRegistro } = pendiente_id
      ? await supabase.from("cambios_calendario").update(registro).eq("id", pendiente_id)
      : await supabase.from("cambios_calendario").insert(registro);
    if (errorRegistro) {
      resumen.avisos.push(`${reserva.codigo_reserva}: las fechas se actualizaron, pero no quedó registrado (${errorRegistro.message}).`);
    }

    resumen.cambiosFechas++;
    resumen.avisos.push(
      `${reserva.codigo_reserva}: Airbnb la movió del ${cambio.reserva_checkin} al ${cambio.reserva_checkout} → del ${desde} al ${hasta}. Se actualizó con su limpieza.`,
    );

    codigos.push(
      reserva.codigo_reserva,
      ...(await reservasVecinas(
        supabase,
        { id: reserva.id, depto_id: reserva.depto_id, fecha_checkin: cambio.reserva_checkin, fecha_checkout: cambio.reserva_checkout },
        [desde, hasta],
      )),
    );
  }

  if (codigos.length > 0) {
    const limpiezas = await generarLimpiezas(supabase, [...new Set(codigos)], hoy);
    resumen.avisos.push(...limpiezas.anomalias);
  }
}

/** Compara la base con los calendarios leídos y deja las marcas al día. */
async function marcarCambios(
  supabase: Cliente,
  idsLeidos: string[],
  vistos: VistoEnCalendario[],
  hoy: string,
  resumen: ResumenSync,
): Promise<Retenida[]> {
  // Solo las vivas, de Airbnb y con salida de hoy en adelante: Airbnb va
  // sacando del calendario las estadías que ya terminaron.
  const reservas = await traerTodo<ReservaComparable>(
    (a, b) =>
      supabase
        .from("reservas")
        .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout")
        .eq("canal", "airbnb")
        .eq("cancelada", false)
        .eq("descartada", false)
        .in("depto_id", idsLeidos)
        .gte("fecha_checkout", hoy)
        .not("fecha_checkin", "is", null)
        .order("id")
        .range(a, b) as unknown as PromiseLike<{
        data: ReservaComparable[] | null;
        error: { message: string } | null;
      }>,
    "las reservas a comparar",
  );

  // Las marcas vivas son pocas (decenas): se traen enteras.
  const { data: marcasCrudas, error: errorMarcas } = await supabase
    .from("cambios_calendario")
    .select("id, reserva_id, tipo, estado, firma, activo, origen, reserva:reservas(cancelada, descartada)")
    .or("estado.eq.pendiente,and(estado.eq.descartado,activo.eq.true)");
  if (errorMarcas) throw new Error(errorMarcas.message);

  const marcas: MarcaExistente[] = (marcasCrudas ?? []).map((m) => ({
    id: m.id,
    reserva_id: m.reserva_id,
    tipo: m.tipo,
    estado: m.estado,
    firma: m.firma,
    activo: m.activo,
    origen: m.origen === "excel" ? "excel" : "calendario",
  }));

  const plan = planificarCambios({ reservas, vistos, marcas });

  // Una pendiente cuya reserva se canceló o descartó por otro camino (a mano,
  // desde la ficha) ya no tiene nada que confirmar.
  const cerradasPorOtroLado = (marcasCrudas ?? [])
    .filter((m) => m.estado === "pendiente" && (m.reserva?.cancelada || m.reserva?.descartada))
    .map((m) => m.id);
  const aCerrar = [...new Set([...plan.resueltasSolas, ...cerradasPorOtroLado])];

  if (aCerrar.length > 0) {
    const { error } = await supabase
      .from("cambios_calendario")
      .update({ estado: "resuelto_solo", resuelto_at: new Date().toISOString() })
      .in("id", aCerrar);
    if (error) throw new Error(error.message);
  }

  if (plan.descartesVencidos.length > 0) {
    const { error } = await supabase
      .from("cambios_calendario")
      .update({ activo: false })
      .in("id", plan.descartesVencidos);
    if (error) throw new Error(error.message);
  }

  for (const { id, ...marca } of plan.actualizar) {
    const { error } = await supabase.from("cambios_calendario").update(marca).eq("id", id);
    if (error) throw new Error(error.message);
  }

  if (plan.nuevas.length > 0) {
    const { error } = await supabase.from("cambios_calendario").insert(plan.nuevas);
    if (error) throw new Error(error.message);
  }

  for (const m of plan.nuevas) {
    if (m.tipo === "posible_cancelacion") resumen.posiblesCancelaciones++;
    else if (m.tipo === "cambio_depto") resumen.cambiosDepto++;
  }

  await aplicarFechas(supabase, plan.fechasAAplicar, hoy, resumen);
  resumen.resueltasSolas = aCerrar.length;
  resumen.retenidas = plan.retenidas.reduce((n, r) => n + r.reserva_ids.length, 0);

  if (plan.retenidas.length > 0) {
    resumen.avisos.push(
      `Se frenaron ${resumen.retenidas} posibles cancelaciones por desaparición masiva. Están en Alertas para revisar.`,
    );
  }

  return plan.retenidas;
}
