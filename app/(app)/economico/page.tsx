import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  agregarPorDeptoMes,
  ganancia,
  saldoPropietario,
  totalizar,
  type Celda,
  type ClaseCuenta,
  type FilaAgregable,
} from "@/lib/economico/calcular";

/**
 * La pantalla del módulo: cómo evoluciona la ganancia mes a mes, de qué está
 * hecha, y qué saldo hay con cada propietario.
 *
 * Tres preguntas, en este orden, porque es el orden en que se miran:
 *
 *   1. ¿Cómo viene el mes contra los anteriores?
 *   2. ¿Eso vino de comisión o de limpieza? Son negocios distintos: la
 *      comisión sigue a cuánto factura el departamento, la limpieza a cuántas
 *      veces se ocupó. Un mes de muchas estadías cortas sube una y no la otra.
 *   3. ¿A quién le debo y quién me debe?
 *
 * Todo se recalcula acá desde los movimientos crudos, igual que la pantalla
 * de conciliación. No hay totales guardados que puedan quedar viejos.
 */

const CAMPOS = `
  categoria, monto, cobrado, tarifa_limpieza, moneda, fecha, depto_id,
  cuenta_id, grupo_con_coanfitrion, noches
`;

type Cruda = {
  categoria: FilaAgregable["categoria"];
  monto: number | null;
  cobrado: number | null;
  tarifa_limpieza: number | null;
  moneda: string;
  fecha: string;
  depto_id: string | null;
  cuenta_id: string | null;
  grupo_con_coanfitrion: boolean;
  noches: number | null;
};

const TOPE = 1000;

const usd = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** `2026-04` → `abr 26`. */
function nombreMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`;
}

export default async function Economico({
  searchParams,
}: {
  searchParams: Promise<{ depto?: string }>;
}) {
  const params = await searchParams;
  const supabase = await crearClienteServidor();

  const crudas: Cruda[] = [];
  for (let desde = 0; ; desde += TOPE) {
    const { data } = await supabase
      .from("movimientos_economicos")
      .select(CAMPOS)
      .range(desde, desde + TOPE - 1);
    const tanda = (data ?? []) as unknown as Cruda[];
    crudas.push(...tanda);
    if (tanda.length < TOPE) break;
  }

  const [{ data: deptos }, { data: cuentas }] = await Promise.all([
    supabase.from("departamentos").select("id, codigo, comision_pct").order("codigo"),
    supabase.from("cuentas_payout").select("id, clasificacion"),
  ]);

  const codigoDepto = new Map((deptos ?? []).map((d) => [d.id, d.codigo]));
  const comisionPct = new Map((deptos ?? []).map((d) => [d.id, Number(d.comision_pct ?? 20)]));
  const claseDeCuenta = new Map(
    (cuentas ?? []).map((c) => [c.id, (c.clasificacion ?? "sin_clasificar") as ClaseCuenta]),
  );

  const filas: FilaAgregable[] = crudas.map((m) => ({
    categoria: m.categoria,
    monto: m.monto,
    cobrado: m.cobrado,
    tarifa_limpieza: m.tarifa_limpieza,
    moneda: m.moneda,
    fecha: m.fecha,
    depto_id: m.depto_id,
    noches: m.noches,
    grupo_con_coanfitrion: m.grupo_con_coanfitrion,
    clase_cuenta:
      m.cuenta_id === null
        ? "sin_clasificar"
        : (claseDeCuenta.get(m.cuenta_id) ?? "sin_clasificar"),
  }));

  const { celdas } = agregarPorDeptoMes(filas, comisionPct);

  if (celdas.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
          Económico
        </h1>
        <div className="rounded-md border border-borde bg-superficie px-6 py-12 text-center shadow-sm">
          <p className="text-tinta-suave">
            Todavía no hay cobros cargados.{" "}
            <Link href="/economico/importar" className="font-medium text-primary underline">
              Importar los CSV de Airbnb
            </Link>
          </p>
        </div>
      </main>
    );
  }

  // ---- Filtro por departamento ----
  const elegido = params.depto ?? null;
  const visibles = elegido ? celdas.filter((c) => c.depto_id === elegido) : celdas;

  // ---- Evolución mensual ----
  const porMes = new Map<string, Celda[]>();
  for (const c of visibles) porMes.set(c.mes, [...(porMes.get(c.mes) ?? []), c]);
  const meses = [...porMes.keys()].sort();
  const filasMes = meses.map((m) => {
    const cs = porMes.get(m)!;
    return {
      mes: m,
      total: totalizar(cs),
      reservas: cs.reduce((s, c) => s + c.reservas, 0),
      noches: cs.reduce((s, c) => s + c.noches, 0),
    };
  });
  const maxGanancia = Math.max(...filasMes.map((f) => ganancia(f.total)), 1);
  const totalPeriodo = totalizar(visibles);

  // ---- Por departamento ----
  const porDepto = new Map<string, Celda[]>();
  for (const c of celdas) porDepto.set(c.depto_id, [...(porDepto.get(c.depto_id) ?? []), c]);
  const filasDepto = [...porDepto.entries()]
    .map(([id, cs]) => ({ id, codigo: codigoDepto.get(id) ?? "—", total: totalizar(cs) }))
    .sort((a, b) => ganancia(b.total) - ganancia(a.total));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
            Económico
          </h1>
          <p className="text-sm tabular-nums text-tinta-suave">
            {elegido ? codigoDepto.get(elegido) : `${porDepto.size} departamentos`} ·{" "}
            {nombreMes(meses[0])} a {nombreMes(meses[meses.length - 1])} · todo en USD
          </p>
        </div>
        {elegido && (
          <Link href="/economico" className={"text-sm text-tinta-suave underline"}>
            ver todos
          </Link>
        )}
      </div>

      {/* ---- 1. La evolución ---- */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-tinta">Ganancia mes a mes</h2>
          <p className="text-sm text-tinta-suave">
            La barra separa de qué está hecha:{" "}
            <span className="font-medium text-primary">comisión</span> sobre el alquiler y{" "}
            <span className="font-medium text-accent">limpieza</span>, que va entera a
            MTHosting y no comisiona.
          </p>
        </div>

        <div className="overflow-x-auto rounded-md border border-borde bg-superficie shadow-sm">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-superficie-alt text-left text-[13px] font-semibold text-warm-700">
              <tr>
                <th className="px-3 py-2">Mes</th>
                <th className="px-3 py-2 w-2/5">Composición</th>
                <th className="px-3 py-2 text-right">Comisión</th>
                <th className="px-3 py-2 text-right">Limpieza</th>
                <th className="px-3 py-2 text-right">Ganancia</th>
                <th className="px-3 py-2 text-right">Reservas</th>
              </tr>
            </thead>
            <tbody>
              {filasMes.map((f) => {
                const g = ganancia(f.total);
                const ancho = (g / maxGanancia) * 100;
                const pctComision = g === 0 ? 0 : (f.total.comision / g) * 100;
                return (
                  <tr key={f.mes} className="h-fila border-t border-borde">
                    <td className="whitespace-nowrap px-3 py-2 font-medium">
                      {nombreMes(f.mes)}
                    </td>
                    <td className="px-3 py-2">
                      {/* La barra no es decoración: el ancho es la ganancia
                          contra el mejor mes, y el corte es la composición. */}
                      <span
                        className="flex h-3 overflow-hidden rounded-full bg-superficie-alt"
                        style={{ width: `${Math.max(ancho, 2)}%` }}
                        title={`comisión ${usd(f.total.comision)} · limpieza ${usd(f.total.limpieza)}`}
                      >
                        <span className="bg-primary" style={{ width: `${pctComision}%` }} />
                        <span className="flex-1 bg-accent" />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{usd(f.total.comision)}</td>
                    <td className="px-3 py-2 text-right">{usd(f.total.limpieza)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{usd(g)}</td>
                    <td className="px-3 py-2 text-right text-tinta-suave">{f.reservas}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="h-fila border-t-2 border-borde-fuerte bg-superficie-alt font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2 text-right">{usd(totalPeriodo.comision)}</td>
                <td className="px-3 py-2 text-right">{usd(totalPeriodo.limpieza)}</td>
                <td className="px-3 py-2 text-right">{usd(ganancia(totalPeriodo))}</td>
                <td className="px-3 py-2 text-right">
                  {filasMes.reduce((s, f) => s + f.reservas, 0)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {totalPeriodo.aircover !== 0 && (
          <p className="text-sm text-tinta-suave">
            Además entraron <strong>{usd(totalPeriodo.aircover)}</strong> de AirCover por
            daños. No están en la ganancia: son indemnizaciones, y según el caso
            corresponden al propietario o a MTHosting.
          </p>
        )}
      </section>

      {/* ---- 2. Por departamento ---- */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-tinta">Por departamento</h2>
          <p className="text-sm text-tinta-suave">
            Ordenados por ganancia, que es lo que mide la rentabilidad. Lo percibido no
            sirve para comparar: un departamento donde se cobró de más para recuperar una
            deuda aparecería primero sin ser el mejor.
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border border-borde bg-superficie shadow-sm">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-superficie-alt text-left text-[13px] font-semibold text-warm-700">
              <tr>
                <th className="px-3 py-2">Departamento</th>
                <th className="px-3 py-2 text-right">Comisión</th>
                <th className="px-3 py-2 text-right">Limpieza</th>
                <th className="px-3 py-2 text-right">Ganancia</th>
                <th className="px-3 py-2 text-right">Percibido</th>
                <th className="px-3 py-2 text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {filasDepto.map((d) => (
                <tr
                  key={d.id}
                  className={`h-fila border-t border-borde ${
                    d.id === elegido ? "bg-superficie-elegida" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <Link
                      href={d.id === elegido ? "/economico" : `/economico?depto=${d.id}`}
                      className="font-mono font-semibold text-primary underline"
                    >
                      {d.codigo}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-right">{usd(d.total.comision)}</td>
                  <td className="px-3 py-2 text-right">{usd(d.total.limpieza)}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {usd(ganancia(d.total))}
                  </td>
                  <td className="px-3 py-2 text-right text-tinta-suave">
                    {usd(d.total.percibido)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Saldo valor={saldoPropietario(d.total)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- 3. Saldos ---- */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-tinta">Saldos con propietarios</h2>
          <p className="text-sm text-tinta-suave">
            Lo que entró menos lo que corresponde a MTHosting. En{" "}
            <span className="font-medium text-accent">naranja</span> lo que hay que
            girarle al propietario; en <span className="font-medium text-dato">azul</span>{" "}
            lo que el propietario le debe a MTHosting.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {filasDepto
            .filter((d) => Math.abs(saldoPropietario(d.total)) >= 0.01)
            .sort(
              (a, b) =>
                Math.abs(saldoPropietario(b.total)) - Math.abs(saldoPropietario(a.total)),
            )
            .map((d) => {
              const s = saldoPropietario(d.total);
              return (
                <div
                  key={d.id}
                  className={`flex items-baseline justify-between gap-3 rounded-md border border-l-[3px] px-4 py-3 ${
                    s > 0
                      ? "border-borde border-l-accent bg-accent-soft"
                      : "border-borde border-l-dato bg-dato-soft"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate font-mono font-semibold text-tinta">{d.codigo}</p>
                    <p className="text-xs text-tinta-suave">
                      {s > 0 ? "hay que girarle" : "le debe a MTHosting"}
                    </p>
                  </div>
                  <p
                    className={`shrink-0 text-lg font-semibold tabular-nums ${
                      s > 0 ? "text-accent-soft-text" : "text-dato-text"
                    }`}
                  >
                    {usd(Math.abs(s))}
                  </p>
                </div>
              );
            })}
        </div>
      </section>

      <p className="text-xs text-tinta-tenue">
        Todo se calcula al abrir la página, desde los movimientos importados. Para ver de
        qué fila del CSV sale cada número está{" "}
        <Link href="/economico/validacion" className="underline">
          la pantalla de validación
        </Link>
        .
      </p>
    </main>
  );
}

function Saldo({ valor }: { valor: number }) {
  if (Math.abs(valor) < 0.005) return <span className="text-tinta-tenue">—</span>;
  return (
    <span className={`font-semibold ${valor > 0 ? "text-accent" : "text-dato"}`}>
      {usd(valor)}
    </span>
  );
}
