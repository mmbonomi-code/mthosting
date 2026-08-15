import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import BotonSincronizar from "./BotonSincronizar";
import { sincronizarAhora } from "./acciones";

export const maxDuration = 60;

function haceCuanto(fecha: string | null): string {
  if (!fecha) return "nunca";
  const minutos = Math.floor((Date.now() - new Date(fecha).getTime()) / 60000);
  if (minutos < 1) return "recién";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  return `hace ${Math.floor(horas / 24)} días`;
}

/**
 * Sincronización por iCal (spec §2.12): el calendario de Airbnb descubre
 * reservas con hasta un año de anticipación. Complementa al CSV, que es el
 * que trae los datos completos.
 */
export default async function ICal() {
  const supabase = await crearClienteServidor();

  const [{ data: departamentos }, { count: tentativas }] = await Promise.all([
    supabase
      .from("departamentos")
      .select("id, codigo, nombre_interno, ical_url, ical_ultima_sync")
      .eq("activo", true)
      .order("codigo"),
    supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("origen", "ical")
      .eq("datos_completos", false),
  ]);

  const conCalendario = (departamentos ?? []).filter((d) => d.ical_url);
  const sinCalendario = (departamentos ?? []).filter((d) => !d.ical_url);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Calendarios de Airbnb
        </h1>
        <p className="text-sm text-tinta-suave">
          El calendario descubre reservas con hasta un año de anticipación. Las
          crea como tentativas: sirven para planificar la limpieza, y el
          archivo de reservas completa después el teléfono y el resto.
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-md border border-borde-control bg-superficie p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium text-tinta">
            {conCalendario.length} de {(departamentos ?? []).length} departamentos
            con calendario
          </h2>
          {(tentativas ?? 0) > 0 && (
            <span className="text-sm text-aviso-text">
              {tentativas} reservas tentativas esperando datos
            </span>
          )}
        </div>
        <BotonSincronizar accion={sincronizarAhora.bind(null, undefined)} />
      </section>

      {conCalendario.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium text-tinta">Con calendario cargado</h2>
          <ul className="flex flex-col gap-2">
            {conCalendario.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-borde px-4 py-2.5"
              >
                <Link
                  href={`/departamentos/${d.id}`}
                  className="font-mono text-sm font-semibold text-tinta hover:underline"
                >
                  {d.codigo}
                </Link>
                <span className="min-w-0 flex-1 truncate text-sm text-tinta-suave">
                  {d.nombre_interno}
                </span>
                <span className="text-xs text-tinta-tenue">
                  {haceCuanto(d.ical_ultima_sync)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {sinCalendario.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium text-tinta">
            Sin calendario
            <span className="ml-2 text-sm font-normal text-tinta-tenue">
              {sinCalendario.length}
            </span>
          </h2>
          <p className="text-sm text-tinta-suave">
            El enlace se copia desde Airbnb (Calendario → Disponibilidad →
            Sincronizar calendarios → Exportar) y se pega en la ficha del
            departamento, en Propiedad.
          </p>
          <ul className="flex flex-wrap gap-2">
            {sinCalendario.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/departamentos/${d.id}/editar`}
                  className="rounded-md border border-borde px-3 py-1.5 font-mono text-xs text-tinta-suave transition-colors hover:border-borde-fuerte hover:text-tinta"
                >
                  {d.codigo}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
