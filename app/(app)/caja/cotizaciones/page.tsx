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
      <Link href="/caja" className="text-sm text-tinta-suave hover:text-tinta">
        ← Volver a la caja
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Cotizaciones</h1>
        <p className="text-sm text-tinta-suave">
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
        <section className="rounded-md border border-aviso/60 bg-aviso-soft/30 p-4">
          <h2 className="text-sm font-medium text-aviso-text">
            {diasPendientes.length} día{diasPendientes.length === 1 ? "" : "s"} con
            movimientos sin cotización
          </h2>
          <p className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-xs text-aviso-text/90">
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
        <h2 className="border-b border-borde pb-1 font-medium text-tinta">
          Cargadas
          <span className="ml-2 text-sm font-normal text-tinta-tenue">
            {(cotizaciones ?? []).length}
          </span>
        </h2>
        {(cotizaciones ?? []).length === 0 ? (
          <p className="py-6 text-center text-sm text-tinta-tenue">
            Todavía no hay ninguna cargada.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {(cotizaciones ?? []).map((c) => (
              <li
                key={c.fecha}
                className="flex items-baseline justify-between rounded-md border border-borde bg-superficie px-3 py-2"
              >
                <span className="text-sm tabular-nums text-tinta-suave">
                  {formatearFechaAR(c.fecha)}
                </span>
                <span className="font-medium tabular-nums text-tinta">
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
