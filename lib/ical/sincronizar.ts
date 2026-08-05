/**
 * Sincronización del calendario iCal de Airbnb (spec §2.12).
 *
 * COMPLEMENTA al CSV, no lo reemplaza: el iCal descubre reservas con hasta un
 * año de anticipación, el CSV completa los datos. Reglas:
 *
 *   - Si la reserva ya existe (venga de donde venga), NO se toca nada.
 *   - Si no existe, se crea con `origen = ical` y `datos_completos = false`,
 *     y se le genera su limpieza tentativa: vale más una limpieza de más,
 *     fácil de cancelar, que una reserva que nadie vio venir.
 *   - Un evento sin código legible se saltea y se informa. Nunca se crea una
 *     reserva sin código.
 *   - Los bloqueos del calendario van a `bloqueos`, no a `reservas`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { parsearICal } from "./parser";
import { generarLimpiezas } from "../limpiezas/generar";
import { hoyAR } from "../fechas";

type Cliente = SupabaseClient<Database>;

export type ResumenSync = {
  departamentos: number;
  reservasNuevas: number;
  reservasExistentes: number;
  bloqueosNuevos: number;
  limpiezasGeneradas: number;
  avisos: string[];
};

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
    return { texto: await respuesta.text() };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "no se pudo leer" };
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
    avisos: [],
  };

  let consulta = supabase
    .from("departamentos")
    .select("id, codigo, ical_url")
    .not("ical_url", "is", null)
    .eq("activo", true);
  if (deptoId) consulta = consulta.eq("id", deptoId);

  const { data: deptos, error } = await consulta;
  if (error) throw new Error(`No se pudieron leer los departamentos: ${error.message}`);
  if (!deptos || deptos.length === 0) return resumen;

  const codigosNuevos: string[] = [];

  for (const depto of deptos) {
    resumen.departamentos++;

    const { texto, error: errorBajada } = await bajarCalendario(depto.ical_url!);
    if (!texto) {
      resumen.avisos.push(`${depto.codigo}: no se pudo leer el calendario (${errorBajada}).`);
      continue;
    }

    const { reservas, bloqueos, salteados } = parsearICal(texto);
    for (const motivo of salteados) resumen.avisos.push(`${depto.codigo}: ${motivo}`);

    // --- Reservas ---
    if (reservas.length > 0) {
      const { data: existentes } = await supabase
        .from("reservas")
        .select("codigo_reserva")
        .in(
          "codigo_reserva",
          reservas.map((r) => r.codigo!),
        );
      const yaEstan = new Set((existentes ?? []).map((r) => r.codigo_reserva));

      const aCrear = reservas.filter((r) => !yaEstan.has(r.codigo!));
      resumen.reservasExistentes += reservas.length - aCrear.length;

      if (aCrear.length > 0) {
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
    }

    // --- Bloqueos del calendario ---
    for (const b of bloqueos) {
      const { data: existente } = await supabase
        .from("bloqueos")
        .select("id")
        .eq("depto_id", depto.id)
        .eq("fecha_desde", b.desde)
        .eq("fecha_hasta", b.hasta)
        .maybeSingle();
      if (existente) continue;

      const { error: errorBloqueo } = await supabase.from("bloqueos").insert({
        depto_id: depto.id,
        fecha_desde: b.desde,
        fecha_hasta: b.hasta,
        motivo: "otro",
        notas: "Bloqueo del calendario de Airbnb",
      });
      if (!errorBloqueo) resumen.bloqueosNuevos++;
    }

    await supabase
      .from("departamentos")
      .update({ ical_ultima_sync: new Date().toISOString() })
      .eq("id", depto.id);
  }

  // Cada reserva descubierta se lleva su limpieza tentativa.
  if (codigosNuevos.length > 0) {
    const limpiezas = await generarLimpiezas(supabase, codigosNuevos, hoyAR());
    resumen.limpiezasGeneradas = limpiezas.generadas;
    resumen.avisos.push(...limpiezas.anomalias);
  }

  return resumen;
}
