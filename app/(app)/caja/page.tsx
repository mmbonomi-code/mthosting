import { clsBoton } from "@/lib/ui";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import {
  formatearFechaAR,
  mesActualAR,
  primerDiaDelMes,
  sumarDias,
  sumarMeses,
} from "@/lib/fechas";
import {
  acumular,
  dolares,
  enDolares,
  estaPendienteDeCobro,
  filtrar,
  pesos,
  totalPorTipo,
  type Movimiento,
  type TipoMovimiento,
} from "@/lib/caja/saldo";
import { codigoConfigurado } from "@/lib/caja/codigo";
import { bloquearCaja } from "./acciones";
import FiltrosCaja from "./FiltrosCaja";
import SinAcceso from "./SinAcceso";

type Cruda = {
  id: string;
  fecha: string;
  tipo: string;
  monto: number;
  moneda: string;
  tc: number | null;
  descripcion: string | null;
  reembolsable: boolean;
  fecha_cobro: string | null;
  forma_cobro: string | null;
  categoria: { id: string; nombre: string } | null;
  depto: { id: string; codigo: string } | null;
};

function Numero({
  etiqueta,
  valor,
  detalle,
  color,
  href,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  color: string;
  href?: string;
}) {
  const contenido = (
    <>
      <span className="text-xs uppercase tracking-wide text-tinta-etiqueta">{etiqueta}</span>
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>{valor}</span>
      {detalle && <span className="text-xs text-tinta-etiqueta">{detalle}</span>}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex flex-col gap-0.5 rounded-lg transition-colors hover:bg-superficie-alt"
      >
        {contenido}
      </Link>
    );
  }
  return <div className="flex flex-col gap-0.5">{contenido}</div>;
}

export default async function Caja({
  searchParams,
}: {
  searchParams: Promise<{
    mes?: string;
    desde?: string;
    hasta?: string;
    q?: string;
    tipo?: string;
    categoria?: string;
    depto?: string;
    cobrar?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await crearClienteServidor();

  if (!(await puedeVerCaja(supabase))) return <SinAcceso />;

  // El período es un mes, o un rango libre si se eligieron las dos fechas.
  // `hasta` se maneja exclusivo adentro, como un check-out.
  const esRangoLibre = Boolean(params.desde && params.hasta);
  const mes = params.mes ?? mesActualAR();
  const desde = esRangoLibre ? params.desde! : primerDiaDelMes(mes);
  const hasta = esRangoLibre
    ? sumarDias(params.hasta!, 1)
    : primerDiaDelMes(sumarMeses(mes, 1));
  const ultimoDia = sumarDias(hasta, -1);

  // "Por cobrar" es una deuda, no un movimiento del mes: lo que se debe de
  // mayo se sigue debiendo en agosto. Por eso ignora el período y trae todo
  // lo pendiente, o mostraría una parte y parecería que faltan.
  const soloPorCobrar = params.cobrar === "1";

  const [
    { data: saldoActual },
    { data: saldoInicial },
    { data: crudos },
    { data: categorias },
    { data: departamentos },
    { count: sinCotizar },
    { data: porCobrarCrudos },
  ] = await Promise.all([
    // El saldo de hoy: una sola agregación en la base, no un recorrido.
    supabase.rpc("saldo_caja"),
    supabase.rpc("saldo_caja_antes", { p_fecha: desde }),
    (() => {
      const base = supabase
        .from("movimientos_caja")
        .select(
          `id, fecha, tipo, monto, moneda, tc, descripcion, reembolsable,
           fecha_cobro, forma_cobro,
           categoria:categorias_movimiento(id, nombre),
           depto:departamentos(id, codigo)`,
        )
        .eq("activo", true);

      return soloPorCobrar
        ? base
            .eq("reembolsable", true)
            .is("fecha_cobro", null)
            .order("fecha")
            .order("created_at")
        : base.gte("fecha", desde).lt("fecha", hasta).order("fecha").order("created_at");
    })(),
    supabase
      .from("categorias_movimiento")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("departamentos")
      .select("id, codigo")
      .eq("estado", "activo")
      .order("codigo"),
    // Movimientos sin tipo de cambio, de toda la historia y no solo del mes:
    // uno de julio pendiente no debería desaparecer solo porque se está
    // mirando agosto.
    supabase
      .from("movimientos_caja")
      .select("id", { count: "exact", head: true })
      .eq("activo", true)
      .is("tc", null),
    // Lo que deben los propietarios, de toda la historia, no solo del mes.
    supabase
      .from("movimientos_caja")
      .select("monto")
      .eq("activo", true)
      .eq("reembolsable", true)
      .is("fecha_cobro", null),
  ]);

  const movimientos: Movimiento[] = ((crudos ?? []) as unknown as Cruda[]).map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo as TipoMovimiento,
    monto: m.monto,
    moneda: m.moneda,
    tc: m.tc,
    descripcion: m.descripcion,
    categoria_id: m.categoria?.id ?? null,
    categoria_nombre: m.categoria?.nombre ?? null,
    depto_id: m.depto?.id ?? null,
    depto_codigo: m.depto?.codigo ?? null,
    reembolsable: m.reembolsable,
    fecha_cobro: m.fecha_cobro,
    forma_cobro: m.forma_cobro,
  }));

  // El saldo renglón por renglón se calcula sobre el mes que se está mirando,
  // arrancando del saldo que dejó todo lo anterior. Con "por cobrar" no
  // aplica: no es un período, es una deuda suelta.
  const conSaldo = soloPorCobrar
    ? movimientos.map((m) => ({ ...m, saldo: null as number | null }))
    : acumular(movimientos, Number(saldoInicial ?? 0));

  const filtros = {
    q: params.q ?? "",
    tipo: (params.tipo ?? "") === "" ? null : (params.tipo as TipoMovimiento),
    categoria: params.categoria ?? "",
    depto: params.depto ?? "",
    // Ya vino filtrado de la base; volver a filtrar acá no cambia nada.
    soloPorCobrar: false,
  };
  const visibles = filtrar(conSaldo, filtros) as (Movimiento & {
    saldo: number | null;
  })[];

  // El saldo corrido necesita calcularse del más viejo al más nuevo (arriba),
  // pero en pantalla se quiere ver al revés: lo más reciente primero. Dar
  // vuelta acá, después de `acumular`, deja el saldo de cada fila intacto.
  const paraMostrar = [...visibles].reverse();

  const porCobrar = (porCobrarCrudos ?? []).reduce((s, m) => s + m.monto, 0);

  // Sin código configurado no hay nada que cerrar: el botón no tendría sentido.
  const pideCodigo = codigoConfigurado();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">Caja</h1>
          <p className="text-sm text-tinta-tenue">
            Ingresos y egresos. El saldo es el de este momento.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/caja/por-cobrar"
            className={clsBoton("secundario")}
          >
            Por cobrar
          </Link>
          <Link
            href="/caja/nuevo"
            className={clsBoton("primario")}
          >
            + Movimiento
          </Link>
        </div>
      </div>

      {/* Sin esto, muy abajo de la página, nadie se enteraba que existía. */}
      {Boolean(sinCotizar) && sinCotizar! > 0 && (
        <Link
          href="/caja/cotizaciones"
          className="flex items-center justify-between gap-3 rounded-xl border border-aviso-borde/60 bg-aviso-soft/30 px-4 py-3 text-sm text-aviso-text-fuerte transition-colors hover:bg-aviso-soft/50"
        >
          <span>
            <strong>{sinCotizar}</strong> movimiento{sinCotizar === 1 ? "" : "s"} sin tipo
            de cambio: no tienen valor en dólares hasta que lo cargues.
          </span>
          <span className="shrink-0 font-medium">Cargar cotizaciones →</span>
        </Link>
      )}

      {/* Lo que Maguie necesita para hacer caja */}
      <section className="grid grid-cols-2 gap-4 rounded-xl border border-borde bg-superficie p-4 sm:grid-cols-4">
        <Numero
          etiqueta="Saldo actual"
          valor={pesos(Number(saldoActual ?? 0))}
          detalle="al día de hoy"
          color={Number(saldoActual ?? 0) < 0 ? "text-error-text" : "text-tinta"}
        />
        <Numero
          etiqueta="Ingresos del mes"
          valor={pesos(totalPorTipo(movimientos, "ingreso"))}
          color="text-exito-text"
        />
        <Numero
          etiqueta="Egresos del mes"
          valor={pesos(totalPorTipo(movimientos, "egreso"))}
          color="text-error-text"
        />
        <Numero
          etiqueta="Por cobrar"
          valor={pesos(porCobrar)}
          detalle="reembolsos pendientes →"
          color={porCobrar > 0 ? "text-aviso-text" : "text-tinta-tenue"}
          href="/caja/por-cobrar"
        />
      </section>

      <FiltrosCaja
        mes={mes}
        desde={desde}
        hasta={ultimoDia}
        esRangoLibre={esRangoLibre}
        q={filtros.q}
        tipo={params.tipo ?? ""}
        categoria={filtros.categoria}
        depto={filtros.depto}
        soloPorCobrar={soloPorCobrar}
        categorias={categorias ?? []}
        departamentos={departamentos ?? []}
      />

      {soloPorCobrar ? (
        <p className="text-xs text-aviso-text">
          {visibles.length} pendiente{visibles.length === 1 ? "" : "s"} de cobro, de
          toda la historia — no solo de este mes.{" "}
          <Link href="/caja/por-cobrar" className="underline underline-offset-4">
            Verlos agrupados por departamento para cobrarlos
          </Link>
        </p>
      ) : (
        <p className="text-xs text-tinta-etiqueta">
          {visibles.length} movimiento{visibles.length === 1 ? "" : "s"} ·{" "}
          {formatearFechaAR(desde)} al {formatearFechaAR(ultimoDia)} · arranca con{" "}
          {pesos(Number(saldoInicial ?? 0))}
        </p>
      )}

      {visibles.length === 0 ? (
        <div className="rounded-xl border border-borde bg-superficie px-6 py-12 text-center">
          <p className="text-tinta-suave">No hay movimientos con estos filtros.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {paraMostrar.map((m) => (
            <li key={m.id}>
              <Link
                href={`/caja/${m.id}`}
                className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-y border-r border-y-borde border-r-borde border-l-4 bg-superficie px-4 py-2.5 transition-colors hover:border-y-borde-fuerte hover:border-r-borde-fuerte ${
                  m.tipo === "ingreso" ? "border-l-exito" : "border-l-borde-control"
                }`}
              >
                <span className="w-14 shrink-0 text-xs tabular-nums text-tinta-etiqueta">
                  {formatearFechaAR(m.fecha).slice(0, 5)}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-tinta">
                    {m.categoria_nombre ?? "Sin categoría"}
                    {m.descripcion && (
                      <span className="font-normal text-tinta-tenue"> · {m.descripcion}</span>
                    )}
                  </span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs">
                    {m.depto_codigo && (
                      <span className="text-exito-text">{m.depto_codigo}</span>
                    )}
                    {estaPendienteDeCobro(m) && (
                      <span className="rounded-full bg-aviso-soft px-2 py-0.5 text-aviso-text">
                        por cobrar
                      </span>
                    )}
                    {m.reembolsable && m.fecha_cobro && (
                      <span className="text-tinta-etiqueta">
                        cobrado {formatearFechaAR(m.fecha_cobro)}
                        {m.forma_cobro && ` · ${m.forma_cobro}`}
                      </span>
                    )}
                  </span>
                </span>

                <span className="shrink-0 text-right">
                  <span
                    className={`block font-semibold tabular-nums ${
                      m.tipo === "ingreso" ? "text-exito-text" : "text-tinta"
                    }`}
                  >
                    {m.tipo === "ingreso" ? "+" : "−"} {pesos(m.monto).replace("$ ", "")}
                  </span>
                  <span className="block text-xs tabular-nums text-tinta-etiqueta">
                    {dolares(enDolares(m))}
                  </span>
                </span>

                {/* Con "por cobrar" no hay saldo: no es un período, es deuda. */}
                {m.saldo !== null && (
                  <span className="w-24 shrink-0 text-right text-xs tabular-nums text-tinta-tenue">
                    {pesos(m.saldo)}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-tinta-etiqueta">
        <Link href="/caja/cotizaciones" className="hover:text-tinta-suave">
          Cotizaciones →
        </Link>
        <Link href="/caja/categorias" className="hover:text-tinta-suave">
          Categorías →
        </Link>
        {pideCodigo && (
          <form action={bloquearCaja} className="ml-auto">
            <button
              type="submit"
              className="rounded-lg border border-borde px-2.5 py-1 text-xs text-tinta-etiqueta transition-colors hover:bg-elevada hover:text-tinta-suave"
            >
              Cerrar la caja
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
