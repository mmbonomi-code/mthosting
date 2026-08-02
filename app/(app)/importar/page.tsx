import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioImportar from "./FormularioImportar";

// Un lote grande puede tardar: se le da a la función el máximo del plan.
export const maxDuration = 60;

export default async function PaginaImportar() {
  const supabase = await crearClienteServidor();

  const { data: historial } = await supabase
    .from("importaciones")
    .select(
      "id, created_at, archivos, filas_total, nuevas, actualizadas, sin_cambios, sin_asignar, canceladas_detectadas, descartadas_reaparecidas",
    )
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Importar reservas
        </h1>
        <p className="text-sm text-slate-400">
          Pensada para usarse desde una computadora.
        </p>
      </div>

      <FormularioImportar />

      {(historial ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium text-white">Últimas importaciones</h2>
          <ul className="flex flex-col gap-2">
            {(historial ?? []).map((imp) => {
              const archivos = Array.isArray(imp.archivos) ? imp.archivos.length : 0;
              const fecha = new Date(imp.created_at).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Buenos_Aires",
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li
                  key={imp.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3 text-sm"
                >
                  <span className="text-slate-300">{fecha}</span>
                  <span className="text-slate-500">
                    {archivos} {archivos === 1 ? "archivo" : "archivos"} ·{" "}
                    {imp.filas_total ?? 0} reservas
                  </span>
                  <span className="text-slate-400">
                    {imp.nuevas ?? 0} nuevas · {imp.actualizadas ?? 0} actualizadas ·{" "}
                    {imp.sin_cambios ?? 0} sin cambios
                  </span>
                  {(imp.sin_asignar ?? 0) > 0 && (
                    <span className="rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                      {imp.sin_asignar} sin departamento
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </main>
  );
}
