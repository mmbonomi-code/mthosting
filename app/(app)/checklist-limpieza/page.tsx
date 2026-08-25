import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { clsBotonPrimario } from "@/lib/ui";
import { moverItemChecklist, moverTareaPeriodica } from "./acciones";

export default async function ChecklistLimpieza() {
  const supabase = await crearClienteServidor();

  const [{ data: items }, { data: periodicas }] = await Promise.all([
    supabase.from("checklist_catalogo").select("id, seccion, item, orden, activo").order("orden"),
    supabase
      .from("tareas_periodicas_catalogo")
      .select("id, item, frecuencia_dias, orden, activo")
      .order("orden"),
  ]);

  const porSeccion = new Map<string, NonNullable<typeof items>>();
  for (const i of items ?? []) {
    porSeccion.set(i.seccion, [...(porSeccion.get(i.seccion) ?? []), i]);
  }
  const tareas = periodicas ?? [];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Checklist de limpieza</h1>
        <p className="text-sm text-slate-400">
          Lo que ve la persona que limpia en el celular: el checklist fijo (se hace siempre) y las
          tareas periódicas (no todas las veces, según hace cuánto se hicieron).
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">
            Checklist fijo
            <span className="ml-2 text-sm font-normal text-slate-500">{(items ?? []).length}</span>
          </h2>
          <Link href="/checklist-limpieza/item/nuevo" className={clsBotonPrimario}>
            + Ítem
          </Link>
        </div>

        {[...porSeccion.entries()].map(([seccion, filas]) => (
          <div key={seccion} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {seccion}
            </h3>
            <ul className="flex flex-col gap-2">
              {filas.map((f, i) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2"
                >
                  <FlechasOrden
                    accionArriba={moverItemChecklist.bind(null, f.id, "arriba")}
                    accionAbajo={moverItemChecklist.bind(null, f.id, "abajo")}
                    esPrimero={i === 0}
                    esUltimo={i === filas.length - 1}
                  />
                  <Link
                    href={`/checklist-limpieza/item/${f.id}/editar`}
                    className="flex min-w-0 flex-1 items-center gap-3 py-1"
                  >
                    <span className="min-w-0 flex-1 truncate text-slate-200">{f.item}</span>
                    {!f.activo && (
                      <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                        Inactivo
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {(items ?? []).length === 0 && (
          <p className="py-6 text-center text-slate-500">Todavía no hay ítems cargados.</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">
            Tareas periódicas
            <span className="ml-2 text-sm font-normal text-slate-500">{tareas.length}</span>
          </h2>
          <Link href="/checklist-limpieza/periodica/nuevo" className={clsBotonPrimario}>
            + Tarea
          </Link>
        </div>
        <p className="text-xs text-slate-500">
          No se hacen en cada limpieza: aparecen marcadas cuando pasaron más días que la frecuencia
          desde la última vez que se hicieron en ese departamento.
        </p>

        <ul className="flex flex-col gap-2">
          {tareas.map((t, i) => (
            <li
              key={t.id}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2"
            >
              <FlechasOrden
                accionArriba={moverTareaPeriodica.bind(null, t.id, "arriba")}
                accionAbajo={moverTareaPeriodica.bind(null, t.id, "abajo")}
                esPrimero={i === 0}
                esUltimo={i === tareas.length - 1}
              />
              <Link
                href={`/checklist-limpieza/periodica/${t.id}/editar`}
                className="flex min-w-0 flex-1 items-center gap-3 py-1"
              >
                <span className="min-w-0 flex-1 truncate text-slate-200">{t.item}</span>
                <span className="shrink-0 text-sm text-slate-500">cada {t.frecuencia_dias} días</span>
                {!t.activo && (
                  <span className="rounded-full bg-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                    Inactivo
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
        {tareas.length === 0 && (
          <p className="py-6 text-center text-slate-500">Todavía no hay tareas periódicas cargadas.</p>
        )}
      </section>
    </main>
  );
}

function FlechasOrden({
  accionArriba,
  accionAbajo,
  esPrimero,
  esUltimo,
}: {
  accionArriba: () => Promise<void>;
  accionAbajo: () => Promise<void>;
  esPrimero: boolean;
  esUltimo: boolean;
}) {
  return (
    <span className="flex shrink-0 flex-col">
      <form action={accionArriba}>
        <button
          type="submit"
          disabled={esPrimero}
          aria-label="Subir"
          className="flex h-6 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
        >
          ▲
        </button>
      </form>
      <form action={accionAbajo}>
        <button
          type="submit"
          disabled={esUltimo}
          aria-label="Bajar"
          className="flex h-6 w-7 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-25 disabled:hover:bg-transparent"
        >
          ▼
        </button>
      </form>
    </span>
  );
}
