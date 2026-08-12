import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import { guardarCotizacion } from "../acciones";
import FormularioCotizacion from "./FormularioCotizacion";
import SinAcceso from "../SinAcceso";

export default async function Cotizaciones() {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCaja(supabase))) return <SinAcceso />;

  const [{ data: cotizaciones }, { data: sinCotizar }] = await Promise.all([
    supabase
      .from("cotizaciones")
      .select("fecha, tc")
      .order("fecha", { ascending: false })
      .limit(120),
    // Los días que tienen movimientos esperando cotización.
    supabase
      .from("movimientos_caja")
      .select("fecha")
      .eq("activo", true)
      .is("tc", null)
      .order("fecha", { ascending: false }),
  ]);

  const diasPendientes = [...new Set((sinCotizar ?? []).map((m) => m.fecha))];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/caja" className="text-sm text-slate-400 hover:text-white">
        ← Volver a la caja
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Cotizaciones</h1>
        <p className="text-sm text-slate-400">
          El dólar de cada día. Al guardarlo se completan solos los movimientos de
          esa fecha que lo estaban esperando.
        </p>
      </div>

      <FormularioCotizacion
        hoy={hoyAR()}
        accion={async (_previo, fd) => {
          "use server";
          return guardarCotizacion(fd);
        }}
      />

      {diasPendientes.length > 0 && (
        <section className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4">
          <h2 className="text-sm font-medium text-amber-200">
            {diasPendientes.length} día{diasPendientes.length === 1 ? "" : "s"} con
            movimientos sin cotización
          </h2>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-amber-400/90">
            {diasPendientes.slice(0, 40).map((f) => (
              <span key={f} className="tabular-nums">
                {formatearFechaAR(f)}
              </span>
            ))}
            {diasPendientes.length > 40 && <span>y {diasPendientes.length - 40} más</span>}
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="border-b border-slate-800 pb-1 font-medium text-white">
          Cargadas
          <span className="ml-2 text-sm font-normal text-slate-500">
            {(cotizaciones ?? []).length}
          </span>
        </h2>
        {(cotizaciones ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Todavía no hay ninguna cargada.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {(cotizaciones ?? []).map((c) => (
              <li
                key={c.fecha}
                className="flex items-baseline justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2"
              >
                <span className="text-sm tabular-nums text-slate-400">
                  {formatearFechaAR(c.fecha)}
                </span>
                <span className="font-medium tabular-nums text-slate-100">
                  {c.tc.toLocaleString("es-AR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
