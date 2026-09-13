"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ErrorImportacion } from "@/lib/importador/parser";
import {
  ejecutarImportacion,
  type ResumenImportacion,
} from "@/lib/importador/ejecutar";
import {
  ejecutarExcelTentativas,
  type ResumenExcelTentativas,
} from "@/lib/importador/ejecutarTentativas";
import { leerHojaXlsx } from "@/lib/importador/xlsx";
import { puedeVerAlertas } from "@/lib/alertas/permisos";

// OJO: un archivo "use server" solo puede exportar funciones async.
// Un `export type { ... }` (re-export) acá se convierte en re-export REAL
// al empaquetar y rompe en runtime con "X is not defined".

export type EstadoExcelTentativas =
  | { resultado: "ok"; resumen: ResumenExcelTentativas }
  | { resultado: "error"; error: string }
  | null;

/**
 * Sube el Excel de tentativas completado. Cancela reservas, así que lo pueden
 * hacer los mismos que confirman cancelaciones en Alertas: administración,
 * manager y coordinación.
 */
export async function importarExcelTentativas(
  _estadoPrevio: EstadoExcelTentativas,
  formData: FormData,
): Promise<EstadoExcelTentativas> {
  const archivo = formData.get("archivo");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return { resultado: "error", error: "Elegí el Excel de tentativas." };
  }

  const supabase = await crearClienteServidor();
  if (!(await puedeVerAlertas(supabase))) {
    return {
      resultado: "error",
      error: "Solo administración, manager y coordinación pueden subir el Excel de tentativas.",
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: persona } = user
    ? await supabase.from("personas").select("id").eq("profile_id", user.id).maybeSingle()
    : { data: null };

  try {
    const bytes = await archivo.arrayBuffer();
    const filas = await leerHojaXlsx(bytes);
    const resumen = await ejecutarExcelTentativas(
      supabase,
      { nombre: archivo.name, filas, bytes },
      { id: user?.id ?? null, personaId: persona?.id ?? null },
    );
    revalidatePath("/importar");
    revalidatePath("/alertas");
    revalidatePath("/dia");
    revalidatePath("/semana");
    return { resultado: "ok", resumen };
  } catch (error) {
    return {
      resultado: "error",
      error: error instanceof Error ? error.message : "Falló la importación.",
    };
  }
}

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
