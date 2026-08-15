import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { clsBotonPrimario } from "@/lib/ui";

const ROLES: Record<string, string> = {
  admin: "Administración",
  manager: "Manager",
  gobernanta: "Gobernanta",
  coordinador: "Coordinación",
  limpieza: "Limpieza",
  propietario: "Propietario",
};

export default async function ListaPersonas() {
  const supabase = await crearClienteServidor();

  const { data: personas } = await supabase
    .from("personas")
    .select("id, nombre, telefono, rol, hace_limpieza, hace_checkin, es_backoffice, activo")
    .order("activo", { ascending: false })
    .order("nombre");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Personas
          <span className="ml-2 text-base font-normal text-tinta-tenue">
            {(personas ?? []).length}
          </span>
        </h1>
        <Link href="/personas/nueva" className={`${clsBotonPrimario} flex items-center`}>
          + Nueva
        </Link>
      </div>

      {(personas ?? []).length === 0 ? (
        <p className="py-12 text-center text-tinta-tenue">
          Todavía no hay personas cargadas.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(personas ?? []).map((p) => (
            <li key={p.id}>
              <Link
                href={`/personas/${p.id}/editar`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-borde bg-superficie px-4 py-3 transition-colors hover:border-borde-fuerte"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-tinta">{p.nombre}</span>
                  <span className="block truncate text-sm text-tinta-tenue">
                    {[
                      p.telefono,
                      p.rol ? ROLES[p.rol] : null,
                      [
                        p.hace_limpieza ? "limpieza" : null,
                        p.hace_checkin ? "check-in" : null,
                      ]
                        .filter(Boolean)
                        .join(", ") || null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                {!p.activo && (
                  <span className="rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-tinta-suave">
                    Inactiva
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
