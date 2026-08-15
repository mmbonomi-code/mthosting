import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import { clsBotonPrimario } from "@/lib/ui";
import { rolDelUsuario } from "@/lib/permisos";
import { puedeEntrar } from "@/lib/secciones";
import FiltrosDepartamentos from "./FiltrosDepartamentos";
import type { Database } from "@/lib/database.types";

const POR_PAGINA = 50;

type Ambientes = Database["public"]["Enums"]["ambientes_tipo"];
type EstadoDepto = Database["public"]["Enums"]["depto_estado"];

export default async function ListaDepartamentos({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    estado?: string;
    ambientes?: string;
    camas?: string;
    huespedes?: string;
    pagina?: string;
  }>;
}) {
  const params = await searchParams;

  const filtros = {
    q: (params.q ?? "").trim(),
    // Por defecto se muestran solo los activos: es la operación del día a
    // día. Elegir "Todos los estados" manda `estado=` vacío y los trae todos.
    estado: params.estado ?? "activo",
    ambientes: params.ambientes ?? "",
    camas: params.camas ?? "",
    huespedes: params.huespedes ?? "",
  };
  // El filtro por defecto no cuenta como "filtro puesto".
  const hayFiltros =
    filtros.q !== "" ||
    filtros.ambientes !== "" ||
    filtros.camas !== "" ||
    filtros.huespedes !== "" ||
    filtros.estado !== "activo";

  const numeroPagina = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);
  const desde = (numeroPagina - 1) * POR_PAGINA;

  const supabase = await crearClienteServidor();
  const puedeCrear = puedeEntrar(await rolDelUsuario(supabase), "/departamentos/nuevo");

  let consulta = supabase
    .from("departamentos")
    .select(
      "id, codigo, nombre_interno, direccion, barrio, ambientes, capacidad, total_camas, estado, activo",
      { count: "exact" },
    )
    .order("codigo")
    .range(desde, desde + POR_PAGINA - 1);

  if (filtros.q) {
    const patron = `%${filtros.q}%`;
    consulta = consulta.or(
      `codigo.ilike.${patron},nombre_interno.ilike.${patron},barrio.ilike.${patron},direccion.ilike.${patron}`,
    );
  }
  if (filtros.estado) {
    consulta = consulta.eq("estado", filtros.estado as EstadoDepto);
  }
  if (filtros.ambientes) {
    consulta = consulta.eq("ambientes", filtros.ambientes as Ambientes);
  }
  if (filtros.camas) {
    consulta = consulta.gte("total_camas", Number.parseInt(filtros.camas, 10));
  }
  if (filtros.huespedes) {
    consulta = consulta.gte("capacidad", Number.parseInt(filtros.huespedes, 10));
  }

  const { data: departamentos, count } = await consulta;
  const total = count ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  /** Conserva los filtros al cambiar de página. */
  const urlPagina = (pagina: number) => {
    const qs = new URLSearchParams();
    for (const [clave, valor] of Object.entries(filtros)) {
      if (valor) qs.set(clave, valor);
    }
    qs.set("pagina", String(pagina));
    return `/departamentos?${qs}`;
  };

  return (
    <main className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Departamentos
          <span className="ml-2 text-base font-normal text-tinta-tenue">
            {total}
            {hayFiltros && " encontrados"}
          </span>
        </h1>
        {puedeCrear && (
          <Link
            href="/departamentos/nuevo"
            className={`${clsBotonPrimario} flex items-center`}
          >
            + Nuevo
          </Link>
        )}
      </div>

      <FiltrosDepartamentos filtros={filtros} hayFiltros={hayFiltros} />

      {(departamentos ?? []).length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-tinta-tenue">
            {hayFiltros
              ? "Ningún departamento coincide con esa búsqueda."
              : "Todavía no hay departamentos cargados."}
          </p>
          {filtros.huespedes && (
            <p className="mx-auto mt-2 max-w-md text-sm text-tinta-tenue">
              La capacidad de huéspedes todavía no está cargada en los
              departamentos migrados desde Ninox, así que este filtro no
              devuelve resultados por ahora.
            </p>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {(departamentos ?? []).map((depto) => (
            <li key={depto.id}>
              <Link
                href={`/departamentos/${depto.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-borde bg-superficie px-4 py-3 transition-colors hover:border-borde-fuerte"
              >
                <span className="w-24 shrink-0 font-mono text-sm font-semibold text-tinta">
                  {depto.codigo}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-tinta">
                    {depto.nombre_interno}
                  </span>
                  <span className="block truncate text-sm text-tinta-tenue">
                    {[depto.direccion, depto.barrio].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span className="hidden text-sm text-tinta-suave sm:block">
                  {[
                    depto.ambientes ? ETIQUETA_AMBIENTES[depto.ambientes] : null,
                    depto.total_camas
                      ? `${depto.total_camas} ${depto.total_camas === 1 ? "cama" : "camas"}`
                      : null,
                    depto.capacidad ? `${depto.capacidad} pers.` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
                {depto.estado === "suspendido" && (
                  <span className="rounded-full bg-aviso-soft px-2.5 py-0.5 text-xs font-medium text-aviso-text">
                    Suspendido
                  </span>
                )}
                {!depto.activo && (
                  <span className="rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-tinta-suave">
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
              href={urlPagina(numeroPagina - 1)}
              className="text-tinta-suave hover:text-tinta"
            >
              ← Anterior
            </Link>
          )}
          <span className="text-tinta-tenue">
            Página {numeroPagina} de {totalPaginas}
          </span>
          {numeroPagina < totalPaginas && (
            <Link
              href={urlPagina(numeroPagina + 1)}
              className="text-tinta-suave hover:text-tinta"
            >
              Siguiente →
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
