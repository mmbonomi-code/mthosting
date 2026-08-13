import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR } from "@/lib/fechas";
import BotonDeshacer from "./BotonDeshacer";

/** Historial de importaciones, con deshacer (spec §4.1 y §6.5). */
export default async function Importaciones() {
  const supabase = await crearClienteServidor();

  const { data: lotes } = await supabase
    .from("importaciones_economico")
    .select(
      "id, tipo, estado, archivos, filas_leidas, filas_nuevas, filas_duplicadas, filas_sin_mapear, avisos, created_at, cerrado_en",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Importaciones
        </h1>
        <p className="text-sm text-slate-400">
          Cada carga es un lote. Deshacer saca sus filas de todos los números; no
          borra nada, y el archivo se puede volver a subir.
        </p>
      </div>

      {(lotes ?? []).length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-12 text-center">
          <p className="text-slate-300">Todavía no se importó nada.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {(lotes ?? []).map((l) => {
            const avisos = (l.avisos as string[] | null) ?? [];
            const deshecho = l.estado === "deshecho";
            return (
              <li
                key={l.id}
                className={`flex flex-col gap-2 rounded-xl border bg-slate-800/40 p-4 ${
                  deshecho ? "border-slate-800 opacity-60" : "border-slate-800"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-medium text-slate-100">
                    {formatearFechaAR(l.created_at.slice(0, 10))}
                    <span className="ml-2 font-normal text-slate-500">
                      {l.tipo === "programado" ? "Programados" : "Cobros efectivos"}
                    </span>
                    {deshecho && (
                      <span className="ml-2 rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-300">
                        deshecha
                      </span>
                    )}
                    {!deshecho && l.cerrado_en === null && (
                      <span className="ml-2 rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">
                        sin terminar
                      </span>
                    )}
                  </span>
                  {!deshecho && l.filas_nuevas > 0 && (
                    <BotonDeshacer importId={l.id} filas={l.filas_nuevas} />
                  )}
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-500">
                  <span className="tabular-nums">
                    {l.archivos} archivo{l.archivos === 1 ? "" : "s"}
                  </span>
                  <span className="tabular-nums text-emerald-300">
                    +{l.filas_nuevas.toLocaleString("es-AR")} filas
                  </span>
                  <span className="tabular-nums">
                    {l.filas_duplicadas.toLocaleString("es-AR")} ya estaban
                  </span>
                  {l.filas_sin_mapear > 0 && (
                    <span className="tabular-nums text-amber-300">
                      {l.filas_sin_mapear} sin departamento
                    </span>
                  )}
                </div>

                {avisos.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-xs text-slate-500">
                      {avisos.length} aviso{avisos.length === 1 ? "" : "s"}
                    </summary>
                    <ul className="mt-1 flex flex-col gap-1 text-xs text-slate-400">
                      {avisos.map((a) => (
                        <li key={a}>{a}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
