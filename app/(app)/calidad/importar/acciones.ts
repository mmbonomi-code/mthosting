"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { leerHojaXlsx } from "@/lib/importador/xlsx";
import { puedeVerCalidad } from "@/lib/calidad/permisos";
import { ErrorArchivoResenas } from "@/lib/calidad/parser";
import { analizarResenas, aplicarResenas, type Previa, type Vinculos } from "@/lib/calidad/importar";

// OJO: un archivo "use server" solo puede exportar funciones async.

export type EstadoImportarResenas =
  | { resultado: "previa"; previa: Previa }
  | { resultado: "ok"; previa: Previa }
  | { resultado: "error"; error: string }
  | null;

/**
 * Un solo punto de entrada para los dos pasos. `paso = "revisar"` arma la
 * previa sin escribir; `paso = "confirmar"` vuelve a leer el mismo archivo y
 * escribe. El archivo viaja las dos veces: la confirmación no confía en una
 * previa guardada en el navegador.
 */
export async function procesarResenas(
  _estadoPrevio: EstadoImportarResenas,
  formData: FormData,
): Promise<EstadoImportarResenas> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { resultado: "error", error: "Elegí el Excel de reseñas." };
  }

  const supabase = await crearClienteServidor();
  if (!(await puedeVerCalidad(supabase))) {
    return { resultado: "error", error: "Solo manager y administración pueden importar reseñas." };
  }

  // Anuncios vinculados a mano en la previa: `vinculo:<id anuncio>` = depto.
  const vinculos: Vinculos = {};
  for (const [clave, valor] of formData.entries()) {
    if (clave.startsWith("vinculo:") && typeof valor === "string" && valor !== "") {
      vinculos[clave.slice("vinculo:".length)] = valor;
    }
  }

  try {
    const bytes = await archivo.arrayBuffer();
    const filas = await leerHojaXlsx(bytes);
    const datos = { nombre: archivo.name, filas, bytes };

    if (formData.get("paso") !== "confirmar") {
      return { resultado: "previa", previa: await analizarResenas(supabase, datos, vinculos) };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    const previa = await aplicarResenas(supabase, datos, vinculos, user?.id ?? null);
    revalidatePath("/calidad", "layout");
    return { resultado: "ok", previa };
  } catch (error) {
    if (error instanceof ErrorArchivoResenas) return { resultado: "error", error: error.message };
    return {
      resultado: "error",
      error: error instanceof Error ? error.message : "Falló la importación.",
    };
  }
}
