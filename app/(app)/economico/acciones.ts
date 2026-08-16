"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerEconomico } from "@/lib/economico/permisos";
import {
  abrirLote,
  cerrarLote,
  deshacerLote,
  importarArchivo,
  type ResultadoArchivoImportado,
  type ResumenLote,
} from "@/lib/economico/importar";

/**
 * Las acciones controlan el permiso por su cuenta. La pantalla ya está
 * cerrada, pero una acción se puede llamar sin pasar por ella.
 */
async function exigirPermiso() {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerEconomico(supabase))) {
    throw new Error("La sección económica es de manager y administración.");
  }
  return supabase;
}

export async function abrirImportacion(
  tipo: "efectivo" | "programado",
): Promise<string> {
  const supabase = await exigirPermiso();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return abrirLote(supabase, tipo, user?.id ?? null);
}

/**
 * Procesa UN archivo del lote. La pantalla los manda de a uno para poder
 * mostrar el avance y para que un archivo roto no se lleve puesto al resto.
 */
export async function procesarArchivo(
  importId: string,
  nombre: string,
  contenido: string,
): Promise<ResultadoArchivoImportado> {
  const supabase = await exigirPermiso();
  try {
    return await importarArchivo(supabase, importId, nombre, contenido);
  } catch (e) {
    // Un error de base tampoco corta el lote: se registra en el archivo y los
    // demás siguen. El resumen final lo va a mostrar.
    return {
      nombre,
      filas_leidas: 0,
      filas_nuevas: 0,
      filas_duplicadas: 0,
      filas_sin_mapear: 0,
      cuentas_nuevas: 0,
      avisos: [],
      error: e instanceof Error ? e.message : "No se pudo procesar el archivo.",
    };
  }
}

export async function cerrarImportacion(importId: string): Promise<ResumenLote> {
  const supabase = await exigirPermiso();
  const resumen = await cerrarLote(supabase, importId);
  revalidatePath("/economico");
  revalidatePath("/economico/importaciones");
  revalidatePath("/economico/anuncios");
  revalidatePath("/economico/cuentas");
  return resumen;
}

export async function deshacerImportacion(importId: string): Promise<void> {
  const supabase = await exigirPermiso();
  await deshacerLote(supabase, importId);
  revalidatePath("/economico");
  revalidatePath("/economico/importaciones");
  revalidatePath("/economico/anuncios");
}

/** Vincula un anuncio a un departamento y arrastra todo lo ya importado. */
export async function mapearAnuncioEconomico(
  anuncio: string,
  deptoId: string,
): Promise<void> {
  const supabase = await exigirPermiso();

  // El alias va a `listing_alias`, la MISMA tabla que usan las reservas. No
  // hay un mapeo paralelo para lo económico.
  const { error: errorAlias } = await supabase.from("listing_alias").upsert(
    { canal: "airbnb", nombre_listing: anuncio, depto_id: deptoId, activo: true },
    { onConflict: "canal,nombre_listing" },
  );
  if (errorAlias) {
    throw new Error(`No se pudo vincular el anuncio: ${errorAlias.message}`);
  }

  // Retroactivo: se reimputa todo lo que ya estaba cargado de ese anuncio, sin
  // volver a importar nada.
  await supabase
    .from("movimientos_economicos")
    .update({ depto_id: deptoId })
    .eq("anuncio", anuncio)
    .is("depto_id", null);
  await supabase
    .from("cobros_programados")
    .update({ depto_id: deptoId })
    .eq("anuncio", anuncio)
    .is("depto_id", null);
  // Y las reservas que estaban esperando ese mismo vínculo.
  await supabase
    .from("reservas")
    .update({ depto_id: deptoId })
    .eq("listing_nombre_raw", anuncio)
    .is("depto_id", null);

  revalidatePath("/economico/anuncios");
  revalidatePath("/economico");
  revalidatePath("/bandeja");
}

/**
 * Marca una cuenta como de MTHosting o del propietario. Aplica a todo el
 * histórico sin reimportar: la clasificación se lee en el momento de calcular.
 */
export async function clasificarCuenta(
  cuentaId: string,
  clasificacion: "mth" | "propietario" | "sin_clasificar",
): Promise<void> {
  const supabase = await exigirPermiso();
  const { error } = await supabase
    .from("cuentas_payout")
    .update({ clasificacion })
    .eq("id", cuentaId);
  if (error) throw new Error(`No se pudo clasificar la cuenta: ${error.message}`);
  revalidatePath("/economico/cuentas");
  revalidatePath("/economico");
}

/**
 * A quién le corresponde un reembolso de AirCover por daños.
 *
 * No se puede deducir del CSV y no se decide solo: si el daño fue a algo del
 * propietario, la indemnización es suya entera; si el gasto lo absorbió
 * MTHosting, es de MTHosting. Por eso hay una pantalla donde se marca uno por
 * uno (spec §5.1).
 *
 * Marcar NO mueve la ganancia ni lo percibido: el AirCover queda afuera de las
 * dos cifras y se informa aparte (decisión de Marcos, 15/08/2026). Lo que hace
 * es dejar registrado de quién es, que es el insumo para liquidarlo.
 */
export async function asignarAirCover(
  movimientoId: string,
  destino: "mthosting" | "propietario" | "sin_asignar",
): Promise<void> {
  const supabase = await exigirPermiso();
  const { error } = await supabase
    .from("movimientos_economicos")
    .update({ aircover_destino: destino })
    .eq("id", movimientoId)
    .eq("categoria", "aircover");
  if (error) throw new Error(`No se pudo asignar el AirCover: ${error.message}`);
  revalidatePath("/economico/aircover");
  revalidatePath("/economico");
}
