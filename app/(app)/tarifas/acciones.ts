"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { sumarDias } from "@/lib/fechas";

export type EstadoFormulario = { error: string } | null;

const AMBIENTES = ["monoambiente", "dos", "tres", "cuatro"] as const;

/**
 * Carga un juego nuevo de valores con una fecha desde (spec §1.1).
 *
 * Rige desde esa fecha, inclusive: toda limpieza de ese día en adelante
 * toma el valor nuevo. Las filas anteriores NO se modifican en su monto —
 * solo se les pone fecha de fin el día previo, para que las limpiezas
 * viejas sigan resolviendo con el valor de su momento.
 */
export async function cargarTarifas(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const desde = String(fd.get("vigente_desde") ?? "").trim();
  const moneda = String(fd.get("moneda") ?? "ARS").trim();
  if (!desde) return { error: "Elegí desde qué fecha rigen estos valores." };

  const nuevas = AMBIENTES.map((ambientes) => {
    const crudo = String(fd.get(`monto_${ambientes}`) ?? "").trim();
    return { ambientes, monto: crudo === "" ? null : Number.parseFloat(crudo) };
  }).filter((t) => t.monto !== null && !Number.isNaN(t.monto));

  if (nuevas.length === 0) {
    return { error: "Cargá al menos un valor." };
  }

  const supabase = await crearClienteServidor();

  // Se cierran las vigentes de esos ambientes el día anterior.
  const { error: errorCierre } = await supabase
    .from("tarifas")
    .update({ vigente_hasta: sumarDias(desde, -1) })
    .in(
      "ambientes",
      nuevas.map((t) => t.ambientes),
    )
    .is("depto_id", null)
    .is("vigente_hasta", null)
    .lt("vigente_desde", desde);
  if (errorCierre) {
    return { error: `No se pudieron cerrar las tarifas anteriores: ${errorCierre.message}` };
  }

  const { error } = await supabase.from("tarifas").insert(
    nuevas.map((t) => ({
      ambientes: t.ambientes,
      monto: t.monto!,
      moneda,
      vigente_desde: desde,
    })),
  );
  if (error) return { error: `No se pudieron guardar los valores: ${error.message}` };

  revalidatePath("/tarifas");
  redirect("/tarifas");
}

/** Valor puntual para un departamento, que le gana al general por ambientes. */
export async function cargarTarifaDepto(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const deptoId = String(fd.get("depto_id") ?? "").trim();
  const desde = String(fd.get("vigente_desde") ?? "").trim();
  const crudo = String(fd.get("monto") ?? "").trim();
  const moneda = String(fd.get("moneda") ?? "ARS").trim();

  if (!deptoId || !desde || crudo === "") {
    return { error: "Completá el departamento, la fecha y el monto." };
  }
  const monto = Number.parseFloat(crudo);
  if (Number.isNaN(monto)) return { error: "El monto no es un número válido." };

  const supabase = await crearClienteServidor();

  await supabase
    .from("tarifas")
    .update({ vigente_hasta: sumarDias(desde, -1) })
    .eq("depto_id", deptoId)
    .is("vigente_hasta", null)
    .lt("vigente_desde", desde);

  const { error } = await supabase
    .from("tarifas")
    .insert({ depto_id: deptoId, monto, moneda, vigente_desde: desde });
  if (error) return { error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/tarifas");
  redirect("/tarifas");
}

// --- Feriados: definen el pago doble junto con los domingos ---

export async function agregarFeriado(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const fecha = String(fd.get("fecha") ?? "").trim();
  const descripcion = String(fd.get("descripcion") ?? "").trim() || null;
  if (!fecha) return { error: "Elegí la fecha." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("feriados").insert({ fecha, descripcion });
  if (error) {
    if (error.code === "23505") return { error: "Ese feriado ya está cargado." };
    return { error: "No se pudo guardar el feriado." };
  }

  revalidatePath("/feriados");
  return null;
}

export async function quitarFeriado(id: string) {
  const supabase = await crearClienteServidor();
  await supabase.from("feriados").delete().eq("id", id);
  revalidatePath("/feriados");
}
