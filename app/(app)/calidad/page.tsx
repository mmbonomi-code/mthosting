import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { clsBotonPrimario, clsTitulo } from "@/lib/ui";
import { diaARDe, formatearFechaAR } from "@/lib/fechas";

/**
 * Portada de Calidad. Por ahora dice qué hay cargado; los promedios por
 * departamento, el ranking y las alertas llegan en los pasos siguientes
 * (docs/CALIDAD-ESPECIFICACION.md §0).
 */
export default async function Calidad() {
  const supabase = await crearClienteServidor();
  const [{ count }, { data: ultima }] = await Promise.all([
    supabase.from("resenas").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase
      .from("importaciones_resenas")
      .select("created_at, archivo_nombre, nuevas, actualizadas")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <h1 className={clsTitulo}>Calidad</h1>
      <div className="rounded-xl border border-borde bg-superficie p-4 text-sm text-tinta-suave">
        {count ? (
          <>
            <p className="text-2xl font-semibold tabular-nums text-tinta">{count} reseñas cargadas</p>
            {ultima && (
              <p className="mt-1 text-tinta-tenue">
                Última carga: {formatearFechaAR(diaARDe(ultima.created_at) ?? "")} ·{" "}
                {ultima.archivo_nombre} · {ultima.nuevas} nuevas, {ultima.actualizadas} actualizadas
              </p>
            )}
          </>
        ) : (
          <p>Todavía no hay reseñas cargadas.</p>
        )}
      </div>
      <div>
        <Link href="/calidad/importar" className={clsBotonPrimario}>
          Importar reseñas
        </Link>
      </div>
    </main>
  );
}
