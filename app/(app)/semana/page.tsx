import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR, sumarDias } from "@/lib/fechas";
import {
  BORDE_SEMAFORO,
  cargaPorPersona,
  semaforoDeLimpieza,
} from "@/lib/limpiezas/semaforo";

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function diaDeLaSemana(fechaISO: string): number {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/**
 * Resumen semanal (spec §3.3): siete filas, una por día, con la proporción
 * de asignadas y sin asignar. Es la pantalla de entrada en el celular.
 */
export default async function Semana({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string }>;
}) {
  const params = await searchParams;
  const hoy = hoyAR();
  const desde = params.desde ?? hoy;
  const hasta = sumarDias(desde, 6);

  const supabase = await crearClienteServidor();

  const [{ data: limpiezas }, { data: feriados }] = await Promise.all([
    supabase
      .from("limpiezas")
      .select("id, fecha, asignado_a, monto_pactado, moneda, responsable:personas(nombre)")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .neq("estado", "cancelada"),
    supabase.from("feriados").select("fecha").gte("fecha", desde).lte("fecha", hasta),
  ]);

  const fechasFeriado = new Set((feriados ?? []).map((f) => f.fecha));

  const dias = Array.from({ length: 7 }, (_, i) => {
    const fecha = sumarDias(desde, i);
    const delDia = (limpiezas ?? []).filter((l) => l.fecha === fecha);
    const asignadas = delDia.filter((l) => l.asignado_a).length;
    return {
      fecha,
      total: delDia.length,
      asignadas,
      sinAsignar: delDia.length - asignadas,
      pagoDoble: diaDeLaSemana(fecha) === 0 || fechasFeriado.has(fecha),
    };
  });

  const total = (limpiezas ?? []).length;
  const totalSinAsignar = (limpiezas ?? []).filter((l) => !l.asignado_a).length;
  const carga = cargaPorPersona(limpiezas ?? []);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Semana
          </h1>
          <p className="text-sm text-slate-400">
            {formatearFechaAR(desde)} al {formatearFechaAR(hasta)} · {total}{" "}
            {total === 1 ? "limpieza" : "limpiezas"}
            {totalSinAsignar > 0 && (
              <span className="text-amber-400"> · {totalSinAsignar} sin asignar</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/semana?desde=${sumarDias(desde, -7)}`}
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            ←
          </Link>
          <Link
            href="/semana"
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            Hoy
          </Link>
          <Link
            href={`/semana?desde=${sumarDias(desde, 7)}`}
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            →
          </Link>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {dias.map((d) => {
          const semaforo = semaforoDeLimpieza({
            fecha: d.fecha,
            hoy,
            tieneResponsable: d.sinAsignar === 0,
          });
          const proporcion = d.total > 0 ? (d.asignadas / d.total) * 100 : 0;

          return (
            <li key={d.fecha}>
              <Link
                href={`/limpiezas?desde=${d.fecha}&dias=1`}
                className={`flex flex-col gap-2 rounded-xl border-y border-r border-y-slate-800 border-r-slate-800 border-l-4 bg-slate-800/40 px-4 py-3 transition-colors hover:border-y-slate-600 hover:border-r-slate-600 ${
                  d.total === 0 ? "border-l-slate-800 opacity-60" : BORDE_SEMAFORO[semaforo]
                }`}
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium capitalize text-white">
                    {DIAS_SEMANA[diaDeLaSemana(d.fecha)]}
                  </span>
                  <span className="text-sm text-slate-400">
                    {formatearFechaAR(d.fecha)}
                  </span>
                  {d.fecha === hoy && (
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
                      hoy
                    </span>
                  )}
                  {d.pagoDoble && d.total > 0 && (
                    <span className="rounded-full bg-emerald-950 px-2 py-0.5 text-xs text-emerald-300">
                      pago doble
                    </span>
                  )}
                  <span className="ml-auto text-sm text-slate-300">
                    {d.total === 0 ? (
                      <span className="text-slate-600">sin limpiezas</span>
                    ) : (
                      <>
                        {d.total} {d.total === 1 ? "limpieza" : "limpiezas"}
                        {d.sinAsignar > 0 && (
                          <span className="ml-2 text-amber-400">
                            {d.sinAsignar} sin asignar
                          </span>
                        )}
                      </>
                    )}
                  </span>
                </div>

                {d.total > 0 && (
                  /* Barra de proporción: cuánto del día ya está repartido */
                  <div className="h-1.5 overflow-hidden rounded-full bg-amber-900/60">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${proporcion}%` }}
                    />
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {carga.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-slate-800 p-4">
          <h2 className="font-medium text-white">Carga de la semana</h2>
          <ul className="flex flex-col gap-1">
            {carga.map((c) => (
              <li key={c.personaId} className="flex flex-wrap items-baseline gap-x-3 text-sm">
                <span className="min-w-32 text-slate-200">{c.nombre}</span>
                <span className="text-slate-400">
                  {c.cantidad} {c.cantidad === 1 ? "limpieza" : "limpiezas"}
                </span>
                {c.monto > 0 && (
                  <span className="ml-auto text-emerald-300">
                    {c.moneda} {c.monto.toLocaleString("es-AR")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
