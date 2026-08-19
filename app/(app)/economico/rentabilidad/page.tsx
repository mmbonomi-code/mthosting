import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { traerTodo } from "@/lib/economico/consultar";
import {
  agregarPorDeptoMes,
  ganancia,
  type ClaseCuenta,
  type FilaAgregable,
} from "@/lib/economico/calcular";
import { calcularRentabilidad, type GastoCaja } from "@/lib/economico/rentabilidad";

/**
 * Ganancia contra gastos, mes a mes, en dólares y en pesos (pedido de
 * Marcos, 18/08/2026). Es la vista de "¿este mes fue rentable?", y por eso
 * arranca en febrero de 2026: antes de eso son restos sueltos de otro
 * sistema, no una serie real.
 *
 * La ganancia sale del motor económico (Airbnb, en USD). Los gastos salen de
 * Caja (en pesos), EXCLUYENDO lo que el propietario reembolsa: eso no es un
 * costo de MTHosting, es plata que se adelanta y se recupera, y no importa
 * si ya se cobró o sigue pendiente.
 */

const ARRANCA = "2026-02";

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function nombreMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${a}`;
}

const usd = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const pesos = (n: number) => `$ ${Math.round(n).toLocaleString("es-AR")}`;

type CrudaEconomico = {
  categoria: FilaAgregable["categoria"];
  monto: number | null;
  cobrado: number | null;
  tarifa_limpieza: number | null;
  moneda: string;
  fecha: string;
  depto_id: string | null;
  cuenta_id: string | null;
  grupo_con_coanfitrion: boolean;
};

export default async function Rentabilidad() {
  const supabase = await crearClienteServidor();

  const [crudasEconomico, deptos, cuentas, gastosCrudos, cotizaciones] = await Promise.all([
    traerTodo<CrudaEconomico>(
      () =>
        supabase
          .from("movimientos_economicos")
          .select(
            "categoria, monto, cobrado, tarifa_limpieza, moneda, fecha, depto_id, cuenta_id, grupo_con_coanfitrion",
          ) as never,
      "los movimientos económicos",
    ),
    traerTodo<{ id: string; comision_pct: number | null }>(
      () => supabase.from("departamentos").select("id, comision_pct") as never,
      "los departamentos",
    ),
    traerTodo<{ id: string; clasificacion: string | null }>(
      () => supabase.from("cuentas_payout").select("id, clasificacion") as never,
      "las cuentas",
    ),
    // Solo desde el arranque: no tiene sentido traer los restos de 2024/2025.
    traerTodo<GastoCaja>(
      () =>
        supabase
          .from("movimientos_caja")
          .select("fecha, monto, tc, tipo, reembolsable, activo")
          .gte("fecha", `${ARRANCA}-01`) as never,
      "los gastos de caja",
    ),
    traerTodo<{ fecha: string; tc: number }>(
      () =>
        supabase
          .from("cotizaciones")
          .select("fecha, tc")
          .gte("fecha", `${ARRANCA}-01`) as never,
      "las cotizaciones",
    ),
  ]);

  // ---- La ganancia mensual, con el mismo motor que el Resumen ----
  const comisionPct = new Map(deptos.map((d) => [d.id, Number(d.comision_pct ?? 20)]));
  const claseDeCuenta = new Map(
    cuentas.map((c) => [c.id, (c.clasificacion ?? "sin_clasificar") as ClaseCuenta]),
  );
  const filasEconomico: FilaAgregable[] = crudasEconomico.map((m) => ({
    categoria: m.categoria,
    monto: m.monto,
    cobrado: m.cobrado,
    tarifa_limpieza: m.tarifa_limpieza,
    moneda: m.moneda,
    fecha: m.fecha,
    depto_id: m.depto_id,
    grupo_con_coanfitrion: m.grupo_con_coanfitrion,
    clase_cuenta:
      m.cuenta_id === null ? "sin_clasificar" : (claseDeCuenta.get(m.cuenta_id) ?? "sin_clasificar"),
  }));
  const { celdas, sinConvertir: gananciaSinConvertir } = agregarPorDeptoMes(
    filasEconomico,
    comisionPct,
  );
  const gananciaPorMes = new Map<string, number>();
  for (const c of celdas) {
    if (c.mes < ARRANCA) continue;
    gananciaPorMes.set(c.mes, (gananciaPorMes.get(c.mes) ?? 0) + ganancia(c));
  }

  const filas = calcularRentabilidad(gananciaPorMes, gastosCrudos, cotizaciones, ARRANCA);

  if (filas.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
          Rentabilidad
        </h1>
        <div className="rounded-md border border-borde bg-superficie px-6 py-12 text-center shadow-sm">
          <p className="text-tinta-suave">
            Todavía no hay ganancia ni gastos cargados desde {nombreMes(ARRANCA)}.
          </p>
        </div>
      </main>
    );
  }

  const totalGananciaUsd = filas.reduce((s, f) => s + f.gananciaUsd, 0);
  const totalGastosUsd = filas.reduce((s, f) => s + f.gastosUsd, 0);
  const totalGastosArs = filas.reduce((s, f) => s + f.gastosArs, 0);
  const mesesSinTc = filas.filter((f) => f.gananciaArs === null).length;
  const gastosSinConvertir = filas.reduce((s, f) => s + f.gastosSinConvertir, 0);
  // Si todos los meses tienen su cotización, sumar la ganancia en pesos entre
  // meses es tan válido como sumar los gastos: son pesos nominales de fechas
  // distintas, ni más ni menos comparables en un caso que en el otro. Solo se
  // vuelve "—" cuando falta la cotización de algún mes y el número quedaría
  // incompleto, no porque sumar pesos de meses distintos sea inválido.
  const totalGananciaArs =
    mesesSinTc === 0 ? filas.reduce((s, f) => s + (f.gananciaArs ?? 0), 0) : null;
  const totalResultadoArs = totalGananciaArs === null ? null : totalGananciaArs - totalGastosArs;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
          Rentabilidad
        </h1>
        <p className="text-sm text-tinta-suave">
          Ganancia contra gastos, mes a mes, desde {nombreMes(ARRANCA)}. No incluye lo que
          reembolsa el propietario: esa plata se adelanta y se recupera, no es un costo de
          MTHosting.
        </p>
      </div>

      {(gastosSinConvertir > 0 || gananciaSinConvertir > 0 || mesesSinTc > 0) && (
        <div className="rounded-md border border-borde border-l-[3px] border-l-accent bg-accent-soft px-4 py-3 text-sm text-accent-soft-text">
          {gastosSinConvertir > 0 && (
            <p>
              {gastosSinConvertir} gasto{gastosSinConvertir === 1 ? "" : "s"} sin tipo de
              cambio: el total en USD de esos meses queda corto hasta que se{" "}
              <Link href="/caja/cotizaciones" className="underline">
                carguen las cotizaciones
              </Link>
              .
            </p>
          )}
          {gananciaSinConvertir > 0 && (
            <p>
              {gananciaSinConvertir} movimiento{gananciaSinConvertir === 1 ? "" : "s"} de
              Airbnb sin tipo de cambio: revisalo en{" "}
              <Link href="/economico/validacion" className="underline">
                Validación
              </Link>
              .
            </p>
          )}
          {mesesSinTc > 0 && (
            <p>
              {mesesSinTc} mes{mesesSinTc === 1 ? "" : "es"} sin ninguna cotización cargada:
              la ganancia de ese mes no se puede pasar a pesos.
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-borde bg-superficie shadow-sm">
        <table className="w-full text-sm tabular-nums">
          <thead className="bg-superficie-alt text-left text-[13px] font-semibold text-warm-700">
            <tr>
              <th className="px-3 py-2">Mes</th>
              <th className="px-3 py-2 text-right">Ganancia USD</th>
              <th className="px-3 py-2 text-right">Gastos USD</th>
              <th className="px-3 py-2 text-right">Resultado USD</th>
              <th className="border-l border-borde px-3 py-2 text-right">Ganancia $</th>
              <th className="px-3 py-2 text-right">Gastos $</th>
              <th className="px-3 py-2 text-right">Resultado $</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.mes} className="h-fila border-t border-borde">
                <td className="whitespace-nowrap px-3 py-2 font-medium capitalize">
                  {nombreMes(f.mes)}
                </td>
                <td className="px-3 py-2 text-right text-exito-text">{usd(f.gananciaUsd)}</td>
                <td className="px-3 py-2 text-right text-error-text">
                  {usd(f.gastosUsd)}
                  {f.gastosSinConvertir > 0 && (
                    <span
                      className="ml-1 text-accent-soft-text"
                      title={`${f.gastosSinConvertir} gasto(s) sin tipo de cambio, no incluidos`}
                    >
                      *
                    </span>
                  )}
                </td>
                <td
                  className={`px-3 py-2 text-right font-semibold ${
                    f.resultadoUsd >= 0 ? "text-primary" : "text-error"
                  }`}
                >
                  {usd(f.resultadoUsd)}
                </td>
                <td className="border-l border-borde px-3 py-2 text-right text-tinta-suave">
                  {f.gananciaArs === null ? "—" : pesos(f.gananciaArs)}
                </td>
                <td className="px-3 py-2 text-right text-tinta-suave">{pesos(f.gastosArs)}</td>
                <td
                  className={`px-3 py-2 text-right font-medium ${
                    f.resultadoArs === null
                      ? "text-tinta-tenue"
                      : f.resultadoArs >= 0
                        ? "text-tinta"
                        : "text-error-text"
                  }`}
                >
                  {f.resultadoArs === null ? "—" : pesos(f.resultadoArs)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="h-fila border-t-2 border-borde-fuerte bg-superficie-alt font-semibold">
              <td className="px-3 py-2">Total</td>
              <td className="px-3 py-2 text-right">{usd(totalGananciaUsd)}</td>
              <td className="px-3 py-2 text-right">{usd(totalGastosUsd)}</td>
              <td className="px-3 py-2 text-right">
                {usd(totalGananciaUsd - totalGastosUsd)}
              </td>
              <td className="border-l border-borde px-3 py-2 text-right text-tinta-tenue">
                {totalGananciaArs === null ? "—" : pesos(totalGananciaArs)}
              </td>
              <td className="px-3 py-2 text-right text-tinta-tenue">{pesos(totalGastosArs)}</td>
              <td className="px-3 py-2 text-right text-tinta-tenue">
                {totalResultadoArs === null ? "—" : pesos(totalResultadoArs)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-tinta-tenue">
        La ganancia en pesos usa la cotización típica de cada mes (la mediana de lo cargado
        en Caja), porque nace en dólares y no tiene un tipo de cambio propio como los
        gastos. Si algún mes todavía no tiene ninguna cotización cargada, el total en pesos
        de la ganancia queda en blanco hasta que se cargue.
      </p>
    </main>
  );
}
