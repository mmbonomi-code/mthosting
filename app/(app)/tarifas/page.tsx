import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import {
  FormularioJuegoTarifas,
  FormularioTarifaDepto,
  type DeptoOpcion,
} from "./FormulariosTarifas";
import { cargarTarifaDepto, cargarTarifas } from "./acciones";

export default async function Tarifas() {
  const supabase = await crearClienteServidor();
  const hoy = hoyAR();

  const [{ data: tarifas }, { data: departamentos }] = await Promise.all([
    supabase
      .from("tarifas")
      .select("id, ambientes, depto_id, monto, moneda, vigente_desde, vigente_hasta, depto:departamentos(codigo)")
      .order("vigente_desde", { ascending: false }),
    supabase
      .from("departamentos")
      .select("id, codigo, nombre_interno")
      .eq("activo", true)
      .order("codigo"),
  ]);

  const vigentes = (tarifas ?? []).filter(
    (t) => t.vigente_desde <= hoy && (t.vigente_hasta === null || t.vigente_hasta >= hoy),
  );
  const porAmbientes = Object.fromEntries(
    vigentes.filter((t) => t.depto_id === null && t.ambientes).map((t) => [t.ambientes!, t.monto]),
  );
  const puntuales = vigentes.filter((t) => t.depto_id !== null);
  const historial = (tarifas ?? []).filter((t) => t.vigente_hasta !== null);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Valores de limpieza
          </h1>
          <p className="text-sm text-slate-400">
            Los montos nunca se editan: se carga un juego nuevo con su fecha de
            inicio y el anterior queda archivado.
          </p>
        </div>
        <Link
          href="/feriados"
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
        >
          Feriados
        </Link>
      </div>

      <section className="rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h2 className="mb-1 font-medium text-white">Vigentes hoy</h2>
        {vigentes.length === 0 ? (
          <p className="py-4 text-sm text-slate-500">
            Todavía no hay valores cargados. Hasta que los cargues, las
            limpiezas se asignan sin monto.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
            {Object.entries(ETIQUETA_AMBIENTES).map(([valor, etiqueta]) => {
              const t = vigentes.find((x) => x.depto_id === null && x.ambientes === valor);
              return (
                <div key={valor} className="flex flex-col gap-0.5">
                  <dt className="text-xs uppercase tracking-wide text-slate-500">
                    {etiqueta}
                  </dt>
                  <dd className="text-lg text-white">
                    {t ? `${t.moneda} ${t.monto}` : "—"}
                  </dd>
                  {t && (
                    <dd className="text-xs text-slate-500">
                      desde {formatearFechaAR(t.vigente_desde)}
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
        )}
        <p className="mt-4 border-t border-slate-700 pt-3 text-xs text-slate-500">
          <strong className="text-slate-400">Reglas de pago:</strong> se paga
          doble en limpieza inicial, profunda, domingos y feriados. El repaso se
          paga el 50%. El pago doble no se acumula.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-white">Cargar valores nuevos</h2>
        <FormularioJuegoTarifas
          accion={cargarTarifas}
          vigentes={porAmbientes}
          hoy={hoy}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-white">
          Excepciones por departamento
          <span className="ml-2 text-sm font-normal text-slate-500">
            le ganan al valor por ambientes
          </span>
        </h2>
        {puntuales.length > 0 && (
          <ul className="flex flex-col gap-2">
            {puntuales.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 rounded-lg border border-slate-800 px-3 py-2 text-sm"
              >
                <span className="font-mono text-slate-200">{t.depto?.codigo}</span>
                <span className="flex-1 text-slate-300">
                  {t.moneda} {t.monto}
                </span>
                <span className="text-slate-500">
                  desde {formatearFechaAR(t.vigente_desde)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <FormularioTarifaDepto
          accion={cargarTarifaDepto}
          departamentos={(departamentos ?? []) as DeptoOpcion[]}
          hoy={hoy}
        />
      </section>

      {historial.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-medium text-white">Historial</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {historial.map((t) => (
              <li key={t.id} className="flex flex-wrap gap-x-3 text-slate-500">
                <span>
                  {t.depto?.codigo ??
                    (t.ambientes ? ETIQUETA_AMBIENTES[t.ambientes] : "—")}
                </span>
                <span className="text-slate-400">
                  {t.moneda} {t.monto}
                </span>
                <span>
                  {formatearFechaAR(t.vigente_desde)} →{" "}
                  {t.vigente_hasta ? formatearFechaAR(t.vigente_hasta) : "vigente"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
