import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR } from "@/lib/fechas";
import { traerTodo } from "@/lib/economico/consultar";
import AsignarAirCover from "./AsignarAirCover";

/**
 * Los reembolsos de AirCover, para decidir de quién es cada uno (spec §5.1).
 *
 * Llegan como "Cobro de la resolución" con "Reembolso de AirCover" en el
 * detalle. No son ingreso del alquiler y no se pueden repartir solos: si el
 * daño fue a algo del propietario, la indemnización le corresponde entera; si
 * el gasto lo absorbió MTHosting, es de MTHosting. Del CSV no sale.
 *
 * Marcar acá NO mueve la ganancia ni lo percibido: el AirCover queda afuera de
 * las dos cifras (decisión de Marcos, 15/08/2026). Deja registrado de quién es,
 * que es lo que hace falta para liquidarlo.
 */

type Destino = "mthosting" | "propietario" | "sin_asignar";

const usd = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Fila = {
  id: string;
  fecha: string;
  monto: number | null;
  moneda: string;
  codigo_confirmacion: string | null;
  huesped: string | null;
  detalles: string | null;
  archivo: string;
  linea: number;
  aircover_destino: Destino;
  depto_id: string | null;
};

export default async function AirCover() {
  const supabase = await crearClienteServidor();

  const filas = await traerTodo<Fila>(
    () =>
      supabase
        .from("movimientos_economicos")
        .select(
          "id, fecha, monto, moneda, codigo_confirmacion, huesped, detalles, archivo, linea, aircover_destino, depto_id",
        )
        .eq("categoria", "aircover")
        .order("fecha", { ascending: false }) as never,
    "los AirCover",
  );

  const { data: deptos } = await supabase.from("departamentos").select("id, codigo");
  const codigoDepto = new Map((deptos ?? []).map((d) => [d.id, d.codigo]));

  const total = (d: Destino) =>
    filas.filter((f) => f.aircover_destino === d).reduce((s, f) => s + Number(f.monto ?? 0), 0);
  const cuantos = (d: Destino) => filas.filter((f) => f.aircover_destino === d).length;
  const sinDecidir = cuantos("sin_asignar");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
          AirCover
        </h1>
        <p className="text-sm text-tinta-suave">
          Reembolsos de Airbnb por daños. No son ingreso del alquiler: si el daño fue a
          algo del propietario la indemnización le corresponde entera, y si el gasto lo
          absorbió MTHosting es de MTHosting. Del archivo no se puede deducir, así que se
          marca uno por uno.
        </p>
      </div>

      {filas.length === 0 ? (
        <div className="rounded-md border border-borde bg-superficie px-6 py-12 text-center shadow-sm">
          <p className="text-tinta-suave">No hay reembolsos de AirCover en lo importado.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-3">
            <Resumen
              titulo="Sin decidir"
              cantidad={sinDecidir}
              monto={total("sin_asignar")}
              tono={
                sinDecidir > 0
                  ? "border-l-accent bg-accent-soft text-accent-soft-text"
                  : "border-l-borde bg-superficie text-tinta-tenue"
              }
            />
            <Resumen
              titulo="De MTHosting"
              cantidad={cuantos("mthosting")}
              monto={total("mthosting")}
              tono="border-l-primary bg-superficie text-primary"
            />
            <Resumen
              titulo="Del propietario"
              cantidad={cuantos("propietario")}
              monto={total("propietario")}
              tono="border-l-dato bg-superficie text-dato"
            />
          </div>

          <p className="text-sm text-tinta-suave">
            Marcar no cambia la ganancia ni lo percibido: el AirCover se informa aparte de
            las dos. Lo que queda es el registro de a quién le corresponde.
          </p>

          <ul className="flex flex-col gap-2">
            {filas.map((f) => (
              <li
                key={f.id}
                className={`flex flex-col gap-3 rounded-md border bg-superficie p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between ${
                  f.aircover_destino === "sin_asignar"
                    ? "border-borde border-l-[3px] border-l-accent"
                    : "border-borde"
                }`}
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono font-semibold text-tinta">
                      {f.depto_id ? (codigoDepto.get(f.depto_id) ?? "—") : "sin departamento"}
                    </span>
                    <span className="font-semibold tabular-nums text-tinta">
                      {f.moneda} {usd(Number(f.monto ?? 0))}
                    </span>
                    <span className="text-sm tabular-nums text-tinta-suave">
                      {formatearFechaAR(f.fecha)}
                    </span>
                  </p>
                  <p className="text-sm text-tinta-suave">
                    {f.huesped ?? "Sin nombre"}
                    {f.codigo_confirmacion && (
                      <span className="ml-2 font-mono text-xs">{f.codigo_confirmacion}</span>
                    )}
                  </p>
                  {/* El detalle trae el número de resolución de Airbnb, que es
                      por dónde se busca el caso para saber qué se rompió. */}
                  {f.detalles && (
                    <p className="mt-0.5 text-xs text-tinta-tenue">{f.detalles}</p>
                  )}
                  <p className="mt-0.5 font-mono text-xs text-tinta-tenue">
                    {f.archivo}:{f.linea}
                  </p>
                </div>
                <AsignarAirCover movimientoId={f.id} actual={f.aircover_destino} />
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-tinta-tenue">
        <Link href="/economico" className="underline">
          Volver al resumen
        </Link>
      </p>
    </main>
  );
}

function Resumen({
  titulo,
  cantidad,
  monto,
  tono,
}: {
  titulo: string;
  cantidad: number;
  monto: number;
  tono: string;
}) {
  return (
    <div className={`rounded-md border border-borde border-l-[3px] p-4 shadow-sm ${tono}`}>
      <p className="text-2xl font-semibold tabular-nums">{usd(monto)}</p>
      <p className="text-sm text-tinta-suave">
        {titulo} · {cantidad} caso{cantidad === 1 ? "" : "s"}
      </p>
    </div>
  );
}
