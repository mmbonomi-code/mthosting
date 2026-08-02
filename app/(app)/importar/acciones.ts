"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ErrorImportacion } from "@/lib/importador/parser";
import {
  ejecutarImportacion,
  type ResumenImportacion,
} from "@/lib/importador/ejecutar";

export type { ResumenImportacion };

export type EstadoImportacion =
  | { resultado: "ok"; resumen: ResumenImportacion }
  | { resultado: "error"; error: string }
  | null;

export async function importarLote(
  _estadoPrevio: EstadoImportacion,
  formData: FormData,
): Promise<EstadoImportacion> {
  const archivos = formData
    .getAll("archivos")
    .filter((a): a is File => a instanceof File && a.size > 0);

  if (archivos.length === 0) {
    return { resultado: "error", error: "Elegí al menos un archivo CSV." };
  }

  const contenidos = await Promise.all(
    archivos.map(async (archivo) => ({
      nombre: archivo.name,
      contenido: await archivo.text(),
    })),
  );

  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  try {
    const resumen = await ejecutarImportacion(supabase, contenidos, user?.id ?? null);
    revalidatePath("/importar");
    return { resultado: "ok", resumen };
  } catch (error) {
    if (error instanceof ErrorImportacion) {
      return { resultado: "error", error: error.message };
    }
    return {
      resultado: "error",
      error: error instanceof Error ? error.message : "Falló la importación.",
    };
  }
}
