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
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Propietarios
          <span className="ml-2 text-base font-normal text-tinta-etiqueta">
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
        <p className="py-12 text-center text-tinta-etiqueta">
          Todavía no hay propietarios cargados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(propietarios ?? []).map((prop) => (
            <li key={prop.id}>
              <Link
                href={`/propietarios/${prop.id}/editar`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-borde bg-superficie px-4 py-3 transition-colors hover:border-borde-fuerte"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-tinta-media">
                    {prop.nombre}
                  </span>
                  <span className="block truncate text-sm text-tinta-etiqueta">
                    {prop.contacto}
                  </span>
                </span>
                {!prop.activo && (
                  <span className="rounded-full bg-elevada-hover px-2.5 py-0.5 text-xs font-medium text-tinta-suave">
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
