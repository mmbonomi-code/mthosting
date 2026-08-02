import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { clsBotonPrimario } from "@/lib/ui";

export default async function ListaPropietarios() {
  const supabase = await crearClienteServidor();

  const { data: propietarios } = await supabase
    .from("propietarios")
    .select("id, nombre, contacto, activo")
    .order("nombre");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Propietarios
          <span className="ml-2 text-base font-normal text-slate-500">
            {(propietarios ?? []).length}
          </span>
        </h1>
        <Link
          href="/propietarios/nuevo"
          className={`${clsBotonPrimario} flex items-center`}
        >
          + Nuevo
        </Link>
      </div>

      {(propietarios ?? []).length === 0 ? (
        <p className="py-12 text-center text-slate-500">
          Todavía no hay propietarios cargados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(propietarios ?? []).map((prop) => (
            <li key={prop.id}>
              <Link
                href={`/propietarios/${prop.id}/editar`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3 transition-colors hover:border-slate-600"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-slate-200">
                    {prop.nombre}
                  </span>
                  <span className="block truncate text-sm text-slate-500">
                    {prop.contacto}
                  </span>
                </span>
                {!prop.activo && (
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
