import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR, sumarDias } from "@/lib/fechas";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";

const ETIQUETA_TIPO: Record<string, string> = {
  inicial: "Inicial",
  repaso: "Repaso",
  normal: "Salida",
  cambio_blancos: "Cambio de blancos",
  con_huespedes: "Con huéspedes",
  desmantelar: "Desmantelar",
  propietario: "Propietario",
};

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Nombre del día de una fecha `yyyy-mm-dd`, sin zonas horarias de por medio. */
function nombreDelDia(fechaISO: string): string {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

export default async function Limpiezas({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; dias?: string }>;
}) {
  const params = await searchParams;
  const hoy = hoyAR();
  const desde = params.desde ?? hoy;
  const dias = Math.min(31, Math.max(1, Number.parseInt(params.dias ?? "7", 10) || 7));
  const hasta = sumarDias(desde, dias - 1);

  const supabase = await crearClienteServidor();

  const { data: limpiezas } = await supabase
    .from("limpiezas")
    .select(
      "id, fecha, tipo, urgente, estado, prox_checkin, depto:departamentos(codigo, nombre_interno, barrio, ambientes), responsable:personas(nombre), reserva:reservas(codigo_reserva, huesped_nombre, noches)",
    )
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .neq("estado", "cancelada")
    .order("fecha")
    .order("urgente", { ascending: false });

  // Agrupadas por día, que es como se trabaja.
  const porDia = new Map<string, NonNullable<typeof limpiezas>>();
  for (const l of limpiezas ?? []) {
    if (!porDia.has(l.fecha)) porDia.set(l.fecha, []);
    porDia.get(l.fecha)!.push(l);
  }

  const sinResponsable = (limpiezas ?? []).filter((l) => !l.responsable).length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Limpiezas
            <span className="ml-2 text-base font-normal text-slate-500">
              {limpiezas?.length ?? 0}
            </span>
          </h1>
          <p className="text-sm text-slate-400">
            {formatearFechaAR(desde)} al {formatearFechaAR(hasta)}
            {sinResponsable > 0 && ` · ${sinResponsable} sin responsable`}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/limpiezas?desde=${sumarDias(desde, -dias)}&dias=${dias}`}
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            ←
          </Link>
          <Link
            href="/limpiezas"
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            Hoy
          </Link>
          <Link
            href={`/limpiezas?desde=${sumarDias(desde, dias)}&dias=${dias}`}
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            →
          </Link>
        </div>
      </div>

      {porDia.size === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-12 text-center">
          <p className="text-slate-300">No hay limpiezas en este período.</p>
          <p className="mt-1 text-sm text-slate-500">
            Se generan solas al importar las reservas.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {[...porDia.entries()].map(([fecha, delDia]) => (
            <section key={fecha} className="flex flex-col gap-2">
              <h2 className="flex items-baseline gap-2 border-b border-slate-800 pb-1">
                <span className="font-medium capitalize text-white">
                  {nombreDelDia(fecha)} {formatearFechaAR(fecha)}
                </span>
                <span className="text-sm text-slate-500">
                  {delDia.length} {delDia.length === 1 ? "limpieza" : "limpiezas"}
                </span>
                {fecha === hoy && (
                  <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
                    hoy
                  </span>
                )}
              </h2>
              <ul className="flex flex-col gap-2">
                {delDia.map((l) => (
                  <li
                    key={l.id}
                    className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border-l-4 bg-slate-800/40 px-4 py-3 ${
                      l.urgente
                        ? "border-l-red-500 border-y border-r border-y-slate-800 border-r-slate-800"
                        : "border-l-slate-700 border-y border-r border-y-slate-800 border-r-slate-800"
                    }`}
                  >
                    <span className="w-32 shrink-0 font-mono text-sm font-semibold text-white">
                      {l.depto?.codigo}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-300">
                        {ETIQUETA_TIPO[l.tipo] ?? l.tipo}
                        {l.depto?.ambientes && ` · ${ETIQUETA_AMBIENTES[l.depto.ambientes]}`}
                        {l.depto?.barrio && ` · ${l.depto.barrio}`}
                      </span>
                      <span className="block text-xs text-slate-500">
                        {l.reserva?.huesped_nombre
                          ? `sale ${l.reserva.huesped_nombre}`
                          : "sin reserva"}
                        {l.prox_checkin &&
                          ` · próximo huésped ${formatearFechaAR(l.prox_checkin.slice(0, 10))}`}
                      </span>
                    </span>
                    {l.urgente && (
                      <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-xs font-medium text-red-300">
                        Urgente
                      </span>
                    )}
                    <span className="text-sm text-slate-400">
                      {l.responsable?.nombre ?? (
                        <span className="text-amber-400">Sin responsable</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600">
        La asignación de responsables se construye en el Paso 8.
      </p>
    </main>
  );
}
