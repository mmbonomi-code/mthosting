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
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">
            Valores de limpieza
          </h1>
          <p className="text-sm text-tinta-suave">
            Los montos nunca se editan: se carga un juego nuevo con su fecha de
            inicio y el anterior queda archivado.
          </p>
        </div>
        <Link
          href="/feriados"
          className="rounded-md border border-borde-control px-4 py-2 text-sm font-medium text-tinta-suave transition-colors hover:bg-superficie-alt"
        >
          Feriados
        </Link>
      </div>

      <section className="rounded-md border border-borde-control bg-superficie p-4">
        <h2 className="mb-1 font-medium text-tinta">Vigentes hoy</h2>
        {vigentes.length === 0 ? (
          <p className="py-4 text-sm text-tinta-tenue">
            Todavía no hay valores cargados. Hasta que los cargues, las
            limpiezas se asignan sin monto.
          </p>
        ) : (
          <dl className="grid grid-cols-2 gap-4 pt-2 sm:grid-cols-4">
            {Object.entries(ETIQUETA_AMBIENTES).map(([valor, etiqueta]) => {
              const t = vigentes.find((x) => x.depto_id === null && x.ambientes === valor);
              return (
                <div key={valor} className="flex flex-col gap-0.5">
                  <dt className="text-xs uppercase tracking-wide text-tinta-tenue">
                    {etiqueta}
                  </dt>
                  <dd className="text-lg text-tinta">
                    {t ? `${t.moneda} ${t.monto}` : "—"}
                  </dd>
                  {t && (
                    <dd className="text-xs text-tinta-tenue">
                      desde {formatearFechaAR(t.vigente_desde)}
                    </dd>
                  )}
                </div>
              );
            })}
          </dl>
        )}
        <p className="mt-4 border-t border-borde-control pt-3 text-xs text-tinta-tenue">
          <strong className="text-tinta-suave">Reglas de pago:</strong> se paga
          doble en limpieza inicial, profunda, domingos y feriados. El repaso se
          paga el 50%. El pago doble no se acumula.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-tinta">Cargar valores nuevos</h2>
        <FormularioJuegoTarifas
          accion={cargarTarifas}
          vigentes={porAmbientes}
          hoy={hoy}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium text-tinta">
          Excepciones por departamento
          <span className="ml-2 text-sm font-normal text-tinta-tenue">
            le ganan al valor por ambientes
          </span>
        </h2>
        {puntuales.length > 0 && (
          <ul className="flex flex-col gap-2">
            {puntuales.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center gap-x-4 rounded-md border border-borde px-3 py-2 text-sm"
              >
                <span className="font-mono text-tinta">{t.depto?.codigo}</span>
                <span className="flex-1 text-tinta-suave">
                  {t.moneda} {t.monto}
                </span>
                <span className="text-tinta-tenue">
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
          <h2 className="font-medium text-tinta">Historial</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {historial.map((t) => (
              <li key={t.id} className="flex flex-wrap gap-x-3 text-tinta-tenue">
                <span>
                  {t.depto?.codigo ??
                    (t.ambientes ? ETIQUETA_AMBIENTES[t.ambientes] : "—")}
                </span>
                <span className="text-tinta-suave">
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
