import { crearClienteServidor } from "@/lib/supabase/server";
import {
  formatearFechaAR,
  mesActualAR,
  nombreDelMes,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
} from "@/lib/fechas";
import {
  ocupacionPorDepto,
  totalizar,
  type BloqueoOcupacion,
  type OcupacionDepto,
  type ReservaOcupacion,
} from "@/lib/dashboard/ocupacion";
import NavegadorPeriodo from "./NavegadorPeriodo";

/** Antes de esta fecha el histórico todavía no está importado. */
const HAY_DATOS_DESDE = "2026-07-01";

function Barra({ fila }: { fila: OcupacionDepto }) {
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-700">
      <div
        className="bg-emerald-500"
        style={{ width: `${fila.pct_ocupado}%` }}
        title={`${fila.noches_ocupadas} noches ocupadas`}
      />
      <div
        className="bg-amber-500"
        style={{ width: `${fila.pct_bloqueado}%` }}
        title={`${fila.noches_bloqueadas} noches bloqueadas`}
      />
    </div>
  );
}

function Numero({
  etiqueta,
  valor,
  detalle,
  color,
}: {
  etiqueta: string;
  valor: string;
  detalle: string;
  color: string;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <span className={`text-3xl font-semibold tabular-nums ${color}`}>{valor}</span>
      <span className="text-xs text-slate-500">{detalle}</span>
    </div>
  );
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; desde?: string; hasta?: string }>;
}) {
  const params = await searchParams;

  // El período se maneja siempre con `hasta` EXCLUSIVO, igual que un
  // check-out. En la URL el rango libre viaja inclusivo, que es lo que
  // entiende cualquiera que lo lea.
  const esRangoLibre = Boolean(params.desde && params.hasta);
  const mes = params.mes ?? mesActualAR();
  const periodo = esRangoLibre
    ? { desde: params.desde!, hasta: sumarDias(params.hasta!, 1) }
    : { desde: primerDiaDelMes(mes), hasta: primerDiaDelMes(sumarMeses(mes, 1)) };
  const ultimaNoche = sumarDias(periodo.hasta, -1);

  const supabase = await crearClienteServidor();

  // Solo los departamentos en operación: sobre los 121 cargados la ocupación
  // no significaría nada.
  const { data: deptos } = await supabase
    .from("departamentos")
    .select("id, codigo, nombre_interno, barrio, ambientes")
    .eq("estado", "activo")
    .order("codigo");

  const ids = (deptos ?? []).map((d) => d.id);

  // Se traen las reservas que TOCAN el período (entran antes y salen después
  // incluidas) y, aparte, las que empiezan adentro para estadía y cancelación.
  const [{ data: reservas }, { data: bloqueos }] = await Promise.all([
    supabase
      .from("reservas")
      .select("depto_id, fecha_checkin, fecha_checkout, cancelada")
      .in("depto_id", ids)
      .eq("descartada", false)
      .lt("fecha_checkin", periodo.hasta)
      .gt("fecha_checkout", periodo.desde),
    supabase
      .from("bloqueos")
      .select("depto_id, fecha_desde, fecha_hasta")
      .in("depto_id", ids)
      .eq("activo", true)
      .lt("fecha_desde", periodo.hasta)
      .gt("fecha_hasta", periodo.desde),
  ]);

  const filas = ocupacionPorDepto(
    ids,
    (reservas ?? []) as ReservaOcupacion[],
    (bloqueos ?? []) as BloqueoOcupacion[],
    periodo,
  );
  const total = totalizar(filas);

  const porId = new Map((deptos ?? []).map((d) => [d.id, d]));
  const ordenadas = [...filas].sort(
    (a, b) =>
      b.pct_ocupado - a.pct_ocupado ||
      (porId.get(a.depto_id)?.codigo ?? "").localeCompare(
        porId.get(b.depto_id)?.codigo ?? "",
      ),
  );

  const periodoIncompleto = periodo.desde < HAY_DATOS_DESDE;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">
          Ocupación de los {ids.length} departamentos en operación ·{" "}
          {formatearFechaAR(periodo.desde)} a {formatearFechaAR(ultimaNoche)}
        </p>
      </div>

      <NavegadorPeriodo
        mes={mes}
        desde={periodo.desde}
        hasta={ultimaNoche}
        esRangoLibre={esRangoLibre}
      />

      {periodoIncompleto && (
        <p className="rounded-lg bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          <strong>Ojo con este período:</strong> las reservas cargadas arrancan en{" "}
          {nombreDelMes("2026-07")}. Lo que se vea antes de esa fecha está
          incompleto, no vacío: falta importar el histórico de Airbnb.
        </p>
      )}

      {/* El total de la operación */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
        <div className="grid grid-cols-3 gap-4">
          <Numero
            etiqueta="Ocupado"
            valor={`${total.pct_ocupado}%`}
            detalle={`${total.noches_ocupadas} noches`}
            color="text-emerald-300"
          />
          <Numero
            etiqueta="Bloqueado"
            valor={`${total.pct_bloqueado}%`}
            detalle={`${total.noches_bloqueadas} noches`}
            color="text-amber-300"
          />
          <Numero
            etiqueta="Libre"
            valor={`${total.pct_libre}%`}
            detalle={`${total.noches_libres} noches`}
            color="text-slate-300"
          />
        </div>
        <Barra fila={total} />
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
          <span>
            {total.reservas} reserva{total.reservas === 1 ? "" : "s"} empezaron en el
            período
          </span>
          {total.estadia_promedio !== null && (
            <span>
              Estadía promedio{" "}
              <span className="text-slate-200">{total.estadia_promedio} noches</span>
            </span>
          )}
          {total.pct_cancelacion !== null && (
            <span>
              Cancelación{" "}
              <span className="text-slate-200">{total.pct_cancelacion}%</span> (
              {total.canceladas})
            </span>
          )}
          <span>{total.noches_totales} noches disponibles en total</span>
        </div>
      </section>

      {/* Departamento por departamento, del más ocupado al menos */}
      <section className="flex flex-col gap-2">
        <h2 className="border-b border-slate-800 pb-1 font-medium text-white">
          Por departamento
          <span className="ml-2 text-sm font-normal text-slate-500">
            del más ocupado al menos
          </span>
        </h2>

        {ordenadas.length === 0 ? (
          <p className="py-3 text-sm text-slate-600">
            No hay departamentos en operación.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ordenadas.map((fila) => {
              const depto = porId.get(fila.depto_id);
              return (
                <li
                  key={fila.depto_id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0 truncate font-medium text-slate-100">
                      {depto?.codigo}
                      {depto?.barrio && (
                        <span className="font-normal text-slate-500">
                          {" "}
                          · {depto.barrio}
                        </span>
                      )}
                    </span>
                    <span className="tabular-nums">
                      <span className="text-base font-semibold text-emerald-300">
                        {fila.pct_ocupado}%
                      </span>
                      {fila.pct_bloqueado > 0 && (
                        <span className="ml-2 text-sm text-amber-300">
                          {fila.pct_bloqueado}% bloq.
                        </span>
                      )}
                    </span>
                  </div>

                  <Barra fila={fila} />

                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                    <span className="tabular-nums">
                      {fila.noches_ocupadas} de {fila.noches_totales} noches
                    </span>
                    <span className="tabular-nums">
                      {fila.reservas} reserva{fila.reservas === 1 ? "" : "s"}
                    </span>
                    {fila.estadia_promedio !== null && (
                      <span className="tabular-nums">
                        {fila.estadia_promedio} noches promedio
                      </span>
                    )}
                    {fila.canceladas > 0 && (
                      <span className="tabular-nums text-slate-400">
                        {fila.pct_cancelacion}% cancelación ({fila.canceladas})
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
