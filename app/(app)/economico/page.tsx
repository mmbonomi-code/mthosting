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
import { traerTodo } from "@/lib/economico/consultar";
import Tablas, { type Celda as CeldaTabla } from "./Tablas";

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

/** Los programados no traen payout ni cuenta: nadie cobró nada todavía. */
const CAMPOS_PROGRAMADO = `
  categoria, monto, tarifa_limpieza, moneda, fecha, depto_id, noches
`;

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

  const crudas = await traerTodo<Cruda>(
    () => supabase.from("movimientos_economicos").select(CAMPOS) as never,
    "los movimientos",
  );

  // Lo que está por cobrarse. Es una foto: cada carga reemplaza la anterior,
  // así que solo se leen los vigentes.
  const programadosCrudos = await traerTodo<Cruda>(
    () =>
      supabase
        .from("cobros_programados")
        .select(CAMPOS_PROGRAMADO)
        .eq("vigente", true) as never,
    "los próximos cobros",
  );

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

  // La ganancia de lo que viene. No se calcula percibido: no entró nada.
  const { celdas: celdasProgramadas } = agregarPorDeptoMes(
    programadosCrudos.map((m) => ({
      categoria: m.categoria,
      monto: m.monto,
      cobrado: null,
      tarifa_limpieza: m.tarifa_limpieza,
      moneda: m.moneda,
      fecha: m.fecha,
      depto_id: m.depto_id,
      noches: m.noches,
    })),
    comisionPct,
  );

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

  // Lo que viaja al cliente: ya calculado, y solo lo que las tablas usan.
  const paraTablas: CeldaTabla[] = celdas.map((c) => ({
    depto_id: c.depto_id,
    codigo: codigoDepto.get(c.depto_id) ?? "—",
    mes: c.mes,
    comision: c.comision,
    limpieza: c.limpieza,
    percibido: c.percibido,
    aircover: c.aircover,
    reservas: c.reservas,
  }));

  const paraTablasProgramado: CeldaTabla[] = celdasProgramadas.map((c) => ({
    depto_id: c.depto_id,
    codigo: codigoDepto.get(c.depto_id) ?? "—",
    mes: c.mes,
    comision: c.comision,
    limpieza: c.limpieza,
    percibido: 0,
    aircover: 0,
    reservas: c.reservas,
  }));

  // ---- Filtro por departamento (el de la dirección, que sobrevive al link) ----
  const elegido = params.depto ?? null;
  const visibles = elegido ? celdas.filter((c) => c.depto_id === elegido) : celdas;

  const meses = [...new Set(celdas.map((c) => c.mes))].sort();
  const totalPeriodo = totalizar(visibles);

  // ---- Saldos por departamento ----
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

      {/* ---- 1 y 2. La evolución y el detalle por departamento ----
           Van en un componente cliente: ordenar y filtrar 7 meses y 54
           departamentos ya calculados es instantáneo en el navegador,
           mientras que hacerlo por dirección obligaría a recalcular los
           5.700 movimientos en cada clic sobre un encabezado. */}
      <Tablas celdas={paraTablas} programados={paraTablasProgramado} />

      {totalPeriodo.aircover !== 0 && (
        <p className="rounded-md border border-borde bg-superficie px-4 py-3 text-sm text-tinta-suave shadow-sm">
          Además entraron{" "}
          <strong className="tabular-nums text-tinta">
            USD {usd(totalPeriodo.aircover)}
          </strong>{" "}
          de AirCover por daños. No están en la ganancia: según el caso corresponden al
          propietario o a MTHosting, y eso se define{" "}
          <Link href="/economico/aircover" className="font-medium text-primary underline">
            en su pantalla
          </Link>
          .
        </p>
      )}

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

