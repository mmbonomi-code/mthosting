import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import FormularioFeriado from "./FormularioFeriado";
import { agregarFeriado, quitarFeriado } from "../tarifas/acciones";

export default async function Feriados() {
  const supabase = await crearClienteServidor();
  const hoy = hoyAR();

  const { data: feriados } = await supabase
    .from("feriados")
    .select("id, fecha, descripcion")
    .order("fecha", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/tarifas" className="text-sm text-slate-400 hover:text-white">
        ← Volver a valores de limpieza
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Feriados
          <span className="ml-2 text-base font-normal text-slate-500">
            {(feriados ?? []).length}
          </span>
        </h1>
        <p className="text-sm text-slate-400">
          Las limpiezas de estos días se pagan doble, igual que los domingos.
        </p>
      </div>

      <FormularioFeriado accion={agregarFeriado} hoy={hoy} />

      {(feriados ?? []).length === 0 ? (
        <p className="py-8 text-center text-slate-500">
          Todavía no hay feriados cargados.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(feriados ?? []).map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center gap-x-4 rounded-lg border border-slate-800 px-4 py-2.5"
            >
              <span className="w-28 shrink-0 text-slate-200">
                {formatearFechaAR(f.fecha)}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm text-slate-400">
                {f.descripcion ?? ""}
              </span>
              <form action={quitarFeriado.bind(null, f.id)}>
                <button
                  type="submit"
                  className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition-colors hover:bg-slate-700"
                >
                  Quitar
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
