import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR } from "@/lib/fechas";
import FormularioVincular, { type DeptoOpcion } from "./FormularioVincular";
import { vincularAnuncio } from "./acciones";

export default async function Bandeja() {
  const supabase = await crearClienteServidor();

  const [{ data: reservas }, { data: departamentos }] = await Promise.all([
    supabase
      .from("reservas")
      .select(
        "id, codigo_reserva, listing_nombre_raw, huesped_nombre, fecha_checkin, fecha_checkout, cancelada",
      )
      .is("depto_id", null)
      .eq("descartada", false)
      .order("fecha_checkin"),
    supabase
      .from("departamentos")
      .select("id, codigo, nombre_interno")
      .eq("activo", true)
      .order("codigo"),
  ]);

  // Se agrupa por anuncio: se mapea una vez y se resuelven todas sus reservas.
  const porAnuncio = new Map<string, NonNullable<typeof reservas>>();
  for (const reserva of reservas ?? []) {
    const clave = reserva.listing_nombre_raw ?? "(sin anuncio)";
    if (!porAnuncio.has(clave)) porAnuncio.set(clave, []);
    porAnuncio.get(clave)!.push(reserva);
  }

  const opciones: DeptoOpcion[] = departamentos ?? [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Reservas sin departamento
          <span className="ml-2 text-base font-normal text-slate-500">
            {reservas?.length ?? 0}
          </span>
        </h1>
        <p className="text-sm text-slate-400">
          Anuncios que el sistema todavía no sabe a qué departamento
          corresponden. Se vinculan una sola vez.
        </p>
      </div>

      {porAnuncio.size === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-12 text-center">
          <p className="text-slate-300">No hay nada pendiente.</p>
          <p className="mt-1 text-sm text-slate-500">
            Todas las reservas importadas tienen su departamento asignado.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {[...porAnuncio.entries()].map(([anuncio, delAnuncio]) => (
            <li
              key={anuncio}
              className="flex flex-col gap-3 rounded-xl border border-amber-900/60 bg-amber-950/20 p-4"
            >
              <div>
                <h2 className="font-medium text-white">{anuncio}</h2>
                <p className="text-sm text-slate-400">
                  {delAnuncio.length}{" "}
                  {delAnuncio.length === 1 ? "reserva" : "reservas"} esperando
                </p>
              </div>

              <ul className="flex flex-col gap-1 text-sm">
                {delAnuncio.slice(0, 5).map((reserva) => (
                  <li key={reserva.id} className="flex flex-wrap gap-x-3 text-slate-400">
                    <span className="font-mono text-slate-300">
                      {reserva.codigo_reserva}
                    </span>
                    <span>{reserva.huesped_nombre ?? "—"}</span>
                    <span>
                      {reserva.fecha_checkin
                        ? formatearFechaAR(reserva.fecha_checkin)
                        : "—"}{" "}
                      →{" "}
                      {reserva.fecha_checkout
                        ? formatearFechaAR(reserva.fecha_checkout)
                        : "—"}
                    </span>
                    {reserva.cancelada && (
                      <span className="text-slate-600">cancelada</span>
                    )}
                  </li>
                ))}
                {delAnuncio.length > 5 && (
                  <li className="text-slate-500">
                    y {delAnuncio.length - 5} más…
                  </li>
                )}
              </ul>

              <FormularioVincular
                accion={vincularAnuncio.bind(null, anuncio)}
                departamentos={opciones}
              />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
