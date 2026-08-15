import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeGestionarReclamos } from "@/lib/reclamos/permisos";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import {
  calcularKpis,
  conPlazos,
  filtrar,
  formatearMonto,
  ordenarPorUrgencia,
  type Foco,
  type ReclamoEnLista,
} from "@/lib/reclamos/lista";
import {
  BORDE_SEMAFORO,
  DIAS_DE_AVISO,
  DIAS_PARA_PRESENTAR,
  DIAS_REALES_AIRBNB,
  textoDePlazo,
  TEXTO_SEMAFORO,
  type EstadoReclamo,
} from "@/lib/reclamos/plazos";
import { ETIQUETA_ESTADO } from "@/lib/reclamos/estados";
import { ETIQUETA_CATEGORIA } from "@/lib/reclamos/categorias";
import BuscadorReserva from "./BuscadorReserva";
import FiltrosReclamos from "./FiltrosReclamos";
import SinAcceso from "./SinAcceso";

/** Tope de seguridad: la operación genera unos pocos reclamos por mes. */
const TOPE = 500;

const CAMPOS = `
  id, estado, categoria, motivo, monto_reclamado, monto_cobrado, moneda,
  url_airbnb, resuelto_at,
  reserva:reservas!inner(
    codigo_reserva, huesped_nombre, huesped_contacto, fecha_checkout,
    depto:departamentos(id, codigo)
  )
`;

type Fila = {
  id: string;
  estado: string;
  categoria: string;
  motivo: string | null;
  monto_reclamado: number | null;
  monto_cobrado: number | null;
  moneda: string;
  url_airbnb: string | null;
  resuelto_at: string | null;
  reserva: {
    codigo_reserva: string;
    huesped_nombre: string | null;
    huesped_contacto: string | null;
    fecha_checkout: string | null;
    depto: { id: string; codigo: string } | null;
  } | null;
};

function Kpi({
  valor,
  etiqueta,
  activo,
  href,
  color,
}: {
  valor: string;
  etiqueta: string;
  activo: boolean;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col rounded-md border px-3 py-2.5 transition-colors ${
        activo
          ? "border-borde-fuerte bg-superficie-alt"
          : "border-borde bg-superficie hover:bg-superficie"
      }`}
    >
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>{valor}</span>
      <span className="text-xs uppercase tracking-wide text-tinta-tenue">{etiqueta}</span>
    </Link>
  );
}

export default async function Reclamos({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; estado?: string; depto?: string; foco?: string }>;
}) {
  const params = await searchParams;
  const supabase = await crearClienteServidor();

  if (!(await puedeGestionarReclamos(supabase))) return <SinAcceso />;

  const hoy = hoyAR();

  const [{ data: crudos }, { data: deptos }] = await Promise.all([
    supabase
      .from("reclamos")
      .select(CAMPOS)
      .eq("activo", true)
      .order("created_at", { ascending: false })
      .limit(TOPE),
    supabase
      .from("departamentos")
      .select("id, codigo")
      .eq("estado", "activo")
      .order("codigo"),
  ]);

  const enLista: ReclamoEnLista[] = ((crudos ?? []) as unknown as Fila[])
    .filter((r) => r.reserva)
    .map((r) => ({
      id: r.id,
      estado: r.estado as EstadoReclamo,
      categoria: r.categoria,
      motivo: r.motivo,
      monto_reclamado: r.monto_reclamado,
      monto_cobrado: r.monto_cobrado,
      moneda: r.moneda,
      url_airbnb: r.url_airbnb,
      resuelto_at: r.resuelto_at,
      codigo_reserva: r.reserva!.codigo_reserva,
      huesped_nombre: r.reserva!.huesped_nombre,
      huesped_contacto: r.reserva!.huesped_contacto,
      fecha_checkout: r.reserva!.fecha_checkout,
      depto_id: r.reserva!.depto?.id ?? null,
      depto_codigo: r.reserva!.depto?.codigo ?? null,
    }));

  const todos = conPlazos(enLista, hoy);
  const kpis = calcularKpis(todos, hoy);

  const foco = (params.foco ?? null) as Foco;
  const filtros = {
    q: params.q ?? "",
    estado: params.estado ?? "",
    depto: params.depto ?? "",
    foco,
  };
  const visibles = ordenarPorUrgencia(filtrar(todos, filtros));

  // Los filtros de texto/estado/depto se conservan al tocar un KPI.
  const conFoco = (valor: Foco) => {
    const p = new URLSearchParams();
    if (filtros.q) p.set("q", filtros.q);
    if (filtros.estado) p.set("estado", filtros.estado);
    if (filtros.depto) p.set("depto", filtros.depto);
    if (valor && valor !== foco) p.set("foco", valor);
    const qs = p.toString();
    return qs ? `/reclamos?${qs}` : "/reclamos";
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-64 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-tinta">Reclamos</h1>
          <p className="text-sm text-tinta-suave">
            Daños a reclamar a Airbnb. {DIAS_PARA_PRESENTAR} días desde el check-out
            para presentar en el Centro de resoluciones —uno menos que los{" "}
            {DIAS_REALES_AIRBNB} de Airbnb, para tener margen— y 30 para escalar a
            AirCover si el huésped no paga.
          </p>
        </div>
        <BuscadorReserva />
      </div>

      {kpis.urgentes > 0 && (
        <p className="rounded-md bg-error-soft/60 px-4 py-3 text-sm text-error-text">
          <strong>
            {kpis.urgentes} reclamo{kpis.urgentes === 1 ? "" : "s"}{" "}
            {kpis.urgentes === 1 ? "vence" : "vencen"} en los próximos {DIAS_DE_AVISO}{" "}
            días o ya {kpis.urgentes === 1 ? "venció" : "vencieron"}.
          </strong>{" "}
          <span className="text-error-text">
            Presentalos antes de que se cumplan los plazos del check-out.
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi
          valor={String(kpis.urgentes)}
          etiqueta={`Vencen en ${DIAS_DE_AVISO} días`}
          activo={foco === "urgente"}
          href={conFoco("urgente")}
          color={kpis.urgentes > 0 ? "text-error-text" : "text-tinta-suave"}
        />
        <Kpi
          valor={String(kpis.sin_presentar)}
          etiqueta="Sin presentar"
          activo={foco === "sin_presentar"}
          href={conFoco("sin_presentar")}
          color="text-aviso-text"
        />
        <Kpi
          valor={String(kpis.esperando)}
          etiqueta="Esperando Airbnb"
          activo={foco === "esperando"}
          href={conFoco("esperando")}
          color="text-tinta"
        />
        <Kpi
          valor={formatearMonto(kpis.cobrado_mes)}
          etiqueta="Cobrado (mes)"
          activo={foco === "cobrado"}
          href={conFoco("cobrado")}
          color="text-exito-text"
        />
      </div>

      <FiltrosReclamos
        q={filtros.q}
        estado={filtros.estado}
        depto={filtros.depto}
        foco={foco}
        departamentos={deptos ?? []}
      />

      {visibles.length === 0 ? (
        <div className="rounded-md border border-borde bg-superficie px-6 py-12 text-center">
          <p className="text-tinta-suave">
            {todos.length === 0
              ? "Todavía no hay reclamos cargados."
              : "No hay reclamos con estos filtros. Probá ampliar el estado o el departamento."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {visibles.map((r) => (
            <li key={r.id}>
              <div
                className={`flex flex-wrap items-start gap-x-3 gap-y-1 rounded-md border-y border-r border-y-borde border-r-borde border-l-4 bg-superficie transition-colors hover:border-y-borde-fuerte hover:border-r-borde-fuerte ${
                  BORDE_SEMAFORO[r.semaforo]
                }`}
              >
                <Link href={`/reclamos/${r.id}`} className="min-w-0 flex-1 px-4 py-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-tinta">
                      {r.depto_codigo ?? "Sin departamento"}
                    </span>
                    <span
                      className={`rounded-full bg-fondo px-2 py-0.5 text-xs ${
                        TEXTO_SEMAFORO[r.semaforo]
                      }`}
                    >
                      {textoDePlazo(r.dias)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-tinta-suave">
                    {ETIQUETA_CATEGORIA[r.categoria] ?? r.categoria} ·{" "}
                    {r.huesped_nombre ?? "Sin nombre"} ·{" "}
                    <span className="font-mono">{r.codigo_reserva}</span>
                    {r.fecha_checkout && ` · salió ${formatearFechaAR(r.fecha_checkout)}`}
                  </span>
                </Link>
                <div className="flex shrink-0 items-center gap-2 px-4 py-3 text-right">
                  <span>
                    <span className="block font-semibold tabular-nums text-tinta">
                      {formatearMonto(r.monto_reclamado, r.moneda)}
                    </span>
                    <span className="block text-xs text-tinta-tenue">
                      {ETIQUETA_ESTADO[r.estado]}
                      {r.estado === "cobrado" &&
                        r.monto_cobrado !== null &&
                        ` ${formatearMonto(r.monto_cobrado, r.moneda)}`}
                    </span>
                  </span>
                  {/* Saltar directo al caso en Airbnb sin abrir la ficha */}
                  {r.url_airbnb && (
                    <a
                      href={r.url_airbnb}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Abrir el caso en Airbnb"
                      className="rounded-md border border-borde-control px-2 py-1 text-sm text-tinta-suave hover:bg-superficie-alt"
                    >
                      ↗
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {todos.length >= TOPE && (
        <p className="text-xs text-tinta-tenue">
          Se muestran los {TOPE} reclamos más recientes.
        </p>
      )}
    </main>
  );
}
