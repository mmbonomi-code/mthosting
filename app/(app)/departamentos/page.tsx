import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import { clsBotonPrimario, clsEntrada } from "@/lib/ui";

const POR_PAGINA = 50;

export default async function ListaDepartamentos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; pagina?: string }>;
}) {
  const { q = "", pagina = "1" } = await searchParams;
  const numeroPagina = Math.max(1, Number.parseInt(pagina, 10) || 1);
  const desde = (numeroPagina - 1) * POR_PAGINA;

  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("departamentos")
    .select("id, codigo, nombre_interno, direccion, barrio, ambientes, capacidad, estado, activo", {
      count: "exact",
    })
    .order("codigo")
    .range(desde, desde + POR_PAGINA - 1);

  const busqueda = q.trim();
  if (busqueda) {
    const patron = `%${busqueda}%`;
    consulta = consulta.or(
      `codigo.ilike.${patron},nombre_interno.ilike.${patron},barrio.ilike.${patron},direccion.ilike.${patron}`,
    );
  }

  const { data: departamentos, count } = await consulta;
  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Departamentos
          <span className="ml-2 text-base font-normal text-slate-500">
            {total}
          </span>
        </h1>
        <Link
          href="/departamentos/nuevo"
          className={`${clsBotonPrimario} flex items-center`}
        >
          + Nuevo
        </Link>
      </div>

      <form className="flex gap-2" action="/departamentos" method="get">
        <input
          type="search"
          name="q"
          defaultValue={busqueda}
          placeholder="Buscar por código, nombre, barrio o dirección…"
          className={clsEntrada}
        />
      </form>

      {(departamentos ?? []).length === 0 ? (
        <p className="py-12 text-center text-slate-500">
          {busqueda
            ? "No se encontró ningún departamento con esa búsqueda."
            : "Todavía no hay departamentos cargados."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(departamentos ?? []).map((depto) => (
            <li key={depto.id}>
              <Link
                href={`/departamentos/${depto.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3 transition-colors hover:border-slate-600"
              >
                <span className="w-24 shrink-0 font-mono text-sm font-semibold text-white">
                  {depto.codigo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-200">
                    {depto.nombre_interno}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {[depto.direccion, depto.barrio].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="hidden text-sm text-slate-400 sm:block">
                  {depto.ambientes ? ETIQUETA_AMBIENTES[depto.ambientes] : ""}
                  {depto.capacidad ? ` · ${depto.capacidad} pers.` : ""}
                </span>
                {depto.estado === "suspendido" && (
                  <span className="rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                    Suspendido
                  </span>
                )}
                {!depto.activo && (
                  <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                    Inactivo
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totalPaginas > 1 && (
        <nav className="flex items-center justify-center gap-4 py-2 text-sm">
          {numeroPagina > 1 && (
            <Link
              href={`/departamentos?q=${encodeURIComponent(busqueda)}&pagina=${numeroPagina - 1}`}
              className="text-slate-300 hover:text-white"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-slate-500">
            Página {numeroPagina} de {totalPaginas}
          </span>
          {numeroPagina < totalPaginas && (
            <Link
              href={`/departamentos?q=${encodeURIComponent(busqueda)}&pagina=${numeroPagina + 1}`}
              className="text-slate-300 hover:text-white"
            >
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
