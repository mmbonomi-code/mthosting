import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { METODOS_ACCESO } from "@/lib/eventos/etiquetas";
import { clsBotonPrimario } from "@/lib/ui";
import { moverPuntoAcceso } from "./acciones";

export default async function PuntosAcceso() {
  const supabase = await crearClienteServidor();

  // El orden lo decide el usuario: así se ofrecen al coordinar.
  const { data: puntos } = await supabase
    .from("puntos_acceso")
    .select(
      "id, metodo, ubicacion, identificador, sirve_checkin, sirve_checkout, recibe_limpieza, activo",
    )
    .order("orden")
    .order("ubicacion");

  const lista = puntos ?? [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Puntos de acceso
            <span className="ml-2 text-base font-normal text-slate-500">
              {lista.length}
            </span>
          </h1>
          <p className="text-sm text-slate-400">
            Candados, sobres y valijas. Un mismo punto puede servir a varios
            departamentos. Con las flechas subís los que más usás: en ese orden
            aparecen al coordinar.
          </p>
        </div>
        <Link href="/puntos-acceso/nuevo" className={`${clsBotonPrimario} flex items-center`}>
          + Nuevo
        </Link>
      </div>

      {lista.length === 0 ? (
        <p className="py-12 text-center text-slate-500">
          Todavía no hay puntos de acceso cargados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lista.map((p, i) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2"
            >
              <span className="flex shrink-0 flex-col">
                <form action={moverPuntoAcceso.bind(null, p.id, "arriba")}>
                  <button
                    type="submit"
                    disabled={i === 0}
                    aria-label="Subir"
                    className="flex h-6 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
                  >
                    ▲
                  </button>
                </form>
                <form action={moverPuntoAcceso.bind(null, p.id, "abajo")}>
                  <button
                    type="submit"
                    disabled={i === lista.length - 1}
                    aria-label="Bajar"
                    className="flex h-6 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
                  >
                    ▼
                  </button>
                </form>
              </span>

              <Link
                href={`/puntos-acceso/${p.id}/editar`}
                className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 py-1"
              >
                <span className="w-24 shrink-0 text-sm text-emerald-300">
                  {METODOS_ACCESO[p.metodo]}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-200">
                    {p.ubicacion}
                    {p.identificador && (
                      <span className="ml-2 font-mono text-sm text-slate-400">
                        {p.identificador}
                      </span>
                    )}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[
                      p.sirve_checkin ? "entrada" : null,
                      p.sirve_checkout ? "salida" : null,
                      p.recibe_limpieza ? "valijas a limpieza" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "no se usa"}
                  </span>
                </span>
                {!p.activo && (
                  <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                    Inactivo
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
