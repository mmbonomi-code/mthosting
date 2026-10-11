"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { personaActual } from "@/lib/permisos";
import { puedeVerCalidad } from "@/lib/calidad/permisos";
import { firmaAlerta } from "@/lib/calidad/alertas";
import { pideArreglo } from "@/lib/calidad/bandeja";
import { CATEGORIAS, type Categoria } from "@/lib/calidad/parser";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";

// OJO: un archivo "use server" solo puede exportar funciones async.

type Resultado = { ok: true } | { ok: false; error: string };

/** La reseña como está HOY en la base, con sus quejas: de ahí sale la firma. */
async function leerResena(supabase: Awaited<ReturnType<typeof crearClienteServidor>>, resenaId: string) {
  const [{ data: r }, { data: quejas }] = await Promise.all([
    supabase
      .from("resenas_atribuidas")
      .select(
        "id, depto_id, limpieza_id, huesped_nombre, fecha_checkout, puntaje_general, puntaje_limpieza, puntaje_veracidad, puntaje_checkin, puntaje_comunicacion, puntaje_ubicacion, puntaje_precio",
      )
      .eq("id", resenaId)
      .maybeSingle(),
    supabase.from("resena_etiquetas").select("texto").eq("resena_id", resenaId).eq("signo", "negativa"),
  ]);
  if (!r) return null;
  return {
    ...r,
    negativas: (quejas ?? []).map((q) => q.texto),
    puntajes: Object.fromEntries(CATEGORIAS.map((c) => [c, r[`puntaje_${c}` as const]])) as Record<
      Categoria,
      number | null
    >,
  };
}

/**
 * Da por revisada una alerta de calidad. Se guarda la firma de lo que se
 * revisó, calculada acá con lo que hay en la base: si una carga posterior
 * cambia la reseña, la alerta vuelve sola.
 */
export async function marcarRevisada(resenaId: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCalidad(supabase))) {
    return { ok: false, error: "Solo manager y administración revisan alertas de calidad." };
  }
  const r = await leerResena(supabase, resenaId);
  if (!r) return { ok: false, error: "No se encontró la reseña." };

  const persona = await personaActual(supabase);
  const { error } = await supabase.from("resena_revisada").upsert(
    {
      resena_id: resenaId,
      firma: firmaAlerta({ puntaje_general: r.puntaje_general!, puntajes: r.puntajes, negativas: r.negativas }),
      revisada_por: persona?.id ?? null,
    },
    { onConflict: "resena_id" },
  );
  if (error) return { ok: false, error: error.message };

  // El contador del menú también cambia.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Crea un arreglo para el departamento con lo que la reseña dice que está
 * roto o necesita mantenimiento.
 *
 * Se ata a la limpieza anterior a la estadía (es donde el panel de Alertas
 * muestra los arreglos); si no hay una en el sistema, a la próxima limpieza
 * del departamento. En `notas` queda la reseña de origen, que es lo que
 * impide crearlo dos veces.
 */
export async function crearArregloDesdeResena(resenaId: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCalidad(supabase))) {
    return { ok: false, error: "Solo manager y administración crean arreglos desde una reseña." };
  }
  const r = await leerResena(supabase, resenaId);
  if (!r) return { ok: false, error: "No se encontró la reseña." };
  if (!r.depto_id) return { ok: false, error: "La reseña no tiene departamento." };

  const marca = `resena:${resenaId}`;
  const { data: yaEsta } = await supabase.from("arreglos").select("id").eq("notas", marca).limit(1);
  if (yaEsta && yaEsta.length > 0) return { ok: true };

  let limpiezaId = r.limpieza_id;
  if (!limpiezaId) {
    const { data: proxima } = await supabase
      .from("limpiezas")
      .select("id")
      .eq("depto_id", r.depto_id)
      .neq("estado", "cancelada")
      .gte("fecha", hoyAR())
      .order("fecha")
      .limit(1)
      .maybeSingle();
    limpiezaId = proxima?.id ?? null;
  }

  const quejas = r.negativas.filter(pideArreglo);
  const lista = (quejas.length > 0 ? quejas : r.negativas).join(" · ") || "revisar el departamento";
  const quien = r.huesped_nombre ? `${r.huesped_nombre}, ` : "";
  const { error } = await supabase.from("arreglos").insert({
    depto_id: r.depto_id,
    limpieza_id: limpiezaId,
    // "Reseña de Airbnb (Oscar, check-out 04/10/2026): Necesita mantenimiento"
    descripcion: `Reseña de Airbnb (${quien}check-out ${formatearFechaAR(r.fecha_checkout!)}): ${lista}`,
    estado: "pendiente",
    fecha: hoyAR(),
    notas: marca,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/calidad/alertas");
  revalidatePath("/alertas");
  return { ok: true };
}
