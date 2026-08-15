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
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Importar reservas
        </h1>
        <p className="text-sm text-tinta-suave">
          Pensada para usarse desde una computadora.
        </p>
      </div>

      <FormularioImportar />

      {(historial ?? []).length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-medium text-tinta">Últimas importaciones</h2>
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
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-borde bg-superficie px-4 py-3 text-sm"
                >
                  <span className="text-tinta-suave">{fecha}</span>
                  <span className="text-tinta-tenue">
                    {archivos} {archivos === 1 ? "archivo" : "archivos"} ·{" "}
                    {imp.filas_total ?? 0} reservas
                  </span>
                  <span className="text-tinta-suave">
                    {imp.nuevas ?? 0} nuevas · {imp.actualizadas ?? 0} actualizadas ·{" "}
                    {imp.sin_cambios ?? 0} sin cambios
                  </span>
                  {(imp.sin_asignar ?? 0) > 0 && (
                    <span className="rounded-full bg-aviso-soft px-2.5 py-0.5 text-xs font-medium text-aviso-text">
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
