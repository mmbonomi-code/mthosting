"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ARREGLO_RESUELTO } from "@/lib/alertas/detectar";
import { CLASE_ARREGLO } from "@/lib/alertas/fotos";
import { puedeVerAlertas } from "@/lib/alertas/permisos";
import { hoyAR } from "@/lib/fechas";
import {
  confirmarCambioEnBase,
  descartarCambioEnBase,
  marcarRetenidasEnBase,
} from "@/lib/ical/confirmar";

/** Lo que devuelven los botones de las marcas del calendario. */
export type EstadoCambio = { error: string } | { ok: string } | null;

async function personaActual(supabase: SupabaseClient<Database>): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("personas").select("id").eq("profile_id", user.id).maybeSingle();
  return data?.id ?? null;
}

function revalidarOperacion() {
  revalidatePath("/alertas");
  revalidatePath("/dia");
  revalidatePath("/semana");
}

const SIN_PERMISO = "Solo administración, manager y coordinación resuelven las marcas del calendario.";

/**
 * Confirmar lo que sugirió el calendario: cancelar la reserva o tomarle las
 * fechas nuevas (decisión del dueño, 13/09/2026: admin, manager y
 * coordinación, los mismos que ven el panel).
 */
export async function confirmarCambioCalendario(id: string): Promise<EstadoCambio> {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerAlertas(supabase))) return { error: SIN_PERMISO };

  const resultado = await confirmarCambioEnBase(supabase, id, await personaActual(supabase), hoyAR());
  revalidarOperacion();
  if ("error" in resultado) return resultado;
  return {
    ok: ["Hecho.", ...resultado.anomalias].join(" "),
  };
}

/** "Sigue en pie" / "Ignorar" / "Ya lo revisé": esta situación no vuelve a marcarse. */
export async function descartarCambioCalendario(id: string): Promise<EstadoCambio> {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerAlertas(supabase))) return { error: SIN_PERMISO };

  const resultado = await descartarCambioEnBase(supabase, id, await personaActual(supabase));
  revalidarOperacion();
  if ("error" in resultado) return resultado;
  return { ok: "Listo." };
}

/** Lo que frenó la desaparición masiva, marcado igual para revisar una por una. */
export async function marcarRetenidas(reservaIds: string[]): Promise<EstadoCambio> {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerAlertas(supabase))) return { error: SIN_PERMISO };

  const resultado = await marcarRetenidasEnBase(supabase, reservaIds);
  revalidarOperacion();
  if ("error" in resultado) return resultado;
  return { ok: `Se marcaron ${resultado.marcadas} como posible cancelación.` };
}

/**
 * Da por revisado un conflicto de cancelación / cambio de fecha (spec §3.6,
 * lista 4).
 *
 * Guarda la FIRMA de lo que se revisó, no un "ya está". Si la reserva vuelve
 * a moverse, la firma nueva no coincide con la guardada y el aviso reaparece
 * solo: dar por bueno un cambio al 15/09 no tapa un segundo cambio al 20/09.
 */
export async function resolverConflicto(limpiezaId: string, firma: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("limpiezas").update({ conflicto_resuelto: firma }).eq("id", limpiezaId);
  revalidatePath("/alertas");
}

/**
 * Da por revisada una alerta que nace de las fotos de la limpieza: un daño
 * que no da para reclamo, o un olvido que ya se resolvió con el huésped.
 *
 * Mismo criterio que arriba: se guarda QUÉ se revisó (cuántas fotos había y
 * cuál era la última). Si la limpieza suma otra foto, la firma cambia y la
 * alerta vuelve sola. Con un "ya está" a secas, la segunda foto quedaría
 * invisible para siempre.
 */
export async function marcarRevisada(clase: string, limpiezaId: string, firma: string) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: persona } = user
    ? await supabase.from("personas").select("id").eq("profile_id", user.id).maybeSingle()
    : { data: null };

  await supabase.from("alerta_revisada").upsert(
    {
      clase,
      limpieza_id: limpiezaId,
      firma,
      revisada_por: persona?.id ?? null,
    },
    { onConflict: "clase,limpieza_id" },
  );
  revalidatePath("/alertas");
}

/**
 * Da por revisado todo lo que la limpieza reportó para arreglar en una
 * limpieza: los arreglos escritos pasan a resueltos, y las fotos quedan
 * marcadas con su firma.
 *
 * Es un solo botón porque es una sola alerta (decisión del dueño,
 * 02/09/2026): si en el departamento hay tres cosas rotas, es un solo viaje
 * del electricista. El detalle fino —resolver una sí y otra no— sigue
 * estando en la ficha de la limpieza.
 */
export async function revisarArreglos(
  limpiezaId: string,
  arregloIds: string[],
  firma: string | null,
) {
  const supabase = await crearClienteServidor();

  if (arregloIds.length > 0) {
    await supabase.from("arreglos").update({ estado: ARREGLO_RESUELTO }).in("id", arregloIds);
  }
  if (firma !== null) await marcarRevisada(CLASE_ARREGLO, limpiezaId, firma);

  revalidatePath("/alertas");
}
