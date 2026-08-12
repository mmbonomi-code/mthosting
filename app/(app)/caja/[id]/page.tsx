import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { formatearFechaAR } from "@/lib/fechas";
import { dolares, enDolares, pesos } from "@/lib/caja/saldo";
import { costoEnDolares, tcPromedio } from "@/lib/caja/cobertura";
import { BUCKET_COMPROBANTES } from "@/lib/caja/tipos";
import {
  anularMovimiento,
  desmarcarCobro,
  editarMovimiento,
  ocultarComprobante,
  subirComprobante,
} from "../acciones";
import FormularioMovimiento from "../FormularioMovimiento";
import Comprobantes, { type Comprobante } from "./Comprobantes";
import SinAcceso from "../SinAcceso";

const MINUTOS_DE_FIRMA = 60;

export default async function FichaMovimiento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCaja(supabase))) return <SinAcceso />;

  const { data: movimiento } = await supabase
    .from("movimientos_caja")
    .select(
      `id, fecha, tipo, monto, moneda, tc, descripcion, reembolsable,
       fecha_cobro, forma_cobro, notas_cobro, activo, ref_externa,
       usd_cambiado, tc_cambio,
       categoria:categorias_movimiento(id, nombre, es_cambio),
       depto:departamentos(id, codigo)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!movimiento) notFound();

  const [{ data: categorias }, { data: departamentos }, { data: archivos }] =
    await Promise.all([
      supabase
        .from("categorias_movimiento")
        .select("id, nombre, es_cambio")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("departamentos")
        .select("id, codigo")
        .eq("estado", "activo")
        .order("codigo"),
      supabase
        .from("movimiento_comprobantes")
        .select("id, storage_path")
        .eq("movimiento_id", id)
        .eq("activo", true)
        .order("created_at"),
    ]);

  const rutas = (archivos ?? []).map((a) => a.storage_path);
  const { data: firmadas } = rutas.length
    ? await supabase.storage
        .from(BUCKET_COMPROBANTES)
        .createSignedUrls(rutas, MINUTOS_DE_FIRMA * 60)
    : { data: [] };
  const urlPorRuta = new Map(
    (firmadas ?? []).map((f) => [f.path ?? "", f.signedUrl as string | null]),
  );

  const comprobantes: Comprobante[] = (archivos ?? []).map((a) => ({
    id: a.id,
    nombre: a.storage_path.split("/").pop() ?? a.storage_path,
    url: urlPorRuta.get(a.storage_path) ?? null,
    esPdf: a.storage_path.toLowerCase().endsWith(".pdf"),
  }));

  // De dónde salió la plata de este gasto: qué bolsa pagó cada tramo.
  const { data: tramosCrudos } = await supabase
    .from("movimiento_cobertura")
    .select(
      `monto, tc,
       origen:movimientos_caja!movimiento_cobertura_origen_id_fkey(id, fecha, descripcion)`,
    )
    .eq("movimiento_id", id);

  type TramoCrudo = {
    monto: number;
    tc: number | null;
    origen: { id: string; fecha: string; descripcion: string | null } | null;
  };
  const tramos = (tramosCrudos ?? []) as unknown as TramoCrudo[];

  const costoReal = costoEnDolares(
    tramos.map((t) => ({
      movimiento_id: id,
      origen_id: t.origen?.id ?? null,
      monto: t.monto,
      tc: t.tc,
    })),
    movimiento.tc,
  );
  const promedio = tcPromedio(
    tramos.map((t) => ({
      movimiento_id: id,
      origen_id: t.origen?.id ?? null,
      monto: t.monto,
      tc: t.tc,
    })),
    movimiento.tc,
  );

  // En un egreso manda el costo real de la plata; en un ingreso, la
  // conversión del día.
  const usd =
    movimiento.tipo === "egreso" && costoReal !== null
      ? costoReal
      : enDolares({ monto: movimiento.monto, tc: movimiento.tc });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/caja" className="text-sm text-slate-400 hover:text-white">
        ← Volver a la caja
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              movimiento.tipo === "ingreso"
                ? "bg-emerald-950 text-emerald-300"
                : "bg-slate-800 text-slate-300"
            }`}
          >
            {movimiento.tipo === "ingreso" ? "Ingreso" : "Egreso"}
          </span>
          {!movimiento.activo && (
            <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-xs text-red-300">
              Anulado
            </span>
          )}
          {movimiento.ref_externa && (
            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs text-slate-400">
              Importado de Ninox
            </span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tabular-nums tracking-tight text-white">
          {pesos(movimiento.monto)}
          <span className="ml-3 text-lg font-normal text-slate-400">
            {usd === null ? "sin cotización" : dolares(usd)}
          </span>
        </h1>
        <p className="text-sm text-slate-400">
          {formatearFechaAR(movimiento.fecha)} ·{" "}
          {movimiento.categoria?.nombre ?? "Sin categoría"}
          {movimiento.depto?.codigo && ` · ${movimiento.depto.codigo}`}
        </p>
      </div>

      {/* Un cambio: cuántos dólares se dieron y a cuánto */}
      {movimiento.usd_cambiado !== null && movimiento.tc_cambio !== null && (
        <section className="rounded-xl border border-emerald-900/60 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
          Se cambiaron{" "}
          <strong>US$ {movimiento.usd_cambiado.toLocaleString("es-AR")}</strong> a{" "}
          <strong>{movimiento.tc_cambio.toLocaleString("es-AR")}</strong>. Los gastos
          que se paguen con esta plata cuestan a ese tipo de cambio.
        </section>
      )}

      {/* De qué bolsa salió cada peso de este gasto */}
      {movimiento.tipo === "egreso" && tramos.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-slate-800 p-4">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            De dónde salió la plata
          </h2>
          <ul className="flex flex-col gap-1.5">
            {tramos.map((t, i) => (
              <li
                key={i}
                className="flex flex-wrap items-baseline justify-between gap-2 text-sm"
              >
                <span className="text-slate-300">
                  {pesos(t.monto)}
                  {t.origen ? (
                    <span className="text-slate-500">
                      {" "}
                      del cambio del {formatearFechaAR(t.origen.fecha)}
                    </span>
                  ) : (
                    <span className="text-amber-300"> sin cubrir todavía</span>
                  )}
                </span>
                <span className="tabular-nums text-slate-400">
                  {t.tc === null ? (
                    <span className="text-slate-500">
                      al dólar del día
                      {movimiento.tc !== null && ` (${movimiento.tc.toLocaleString("es-AR")})`}
                    </span>
                  ) : (
                    `a ${t.tc.toLocaleString("es-AR")}`
                  )}
                </span>
              </li>
            ))}
          </ul>
          {promedio !== null && tramos.length > 1 && (
            <p className="border-t border-slate-800 pt-2 text-xs text-slate-500">
              Tipo de cambio promedio de este gasto:{" "}
              <span className="text-slate-300">{promedio.toLocaleString("es-AR")}</span>
            </p>
          )}
        </section>
      )}

      {/* Estado del reembolso */}
      {movimiento.reembolsable && (
        <section
          className={`flex flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3 ${
            movimiento.fecha_cobro
              ? "bg-emerald-950/50 text-emerald-200"
              : "bg-amber-950/40 text-amber-200"
          }`}
        >
          <div className="text-sm">
            {movimiento.fecha_cobro ? (
              <>
                <strong>Cobrado</strong> el {formatearFechaAR(movimiento.fecha_cobro)}
                {movimiento.forma_cobro && ` por ${movimiento.forma_cobro}`}
                {movimiento.notas_cobro && (
                  <span className="block text-xs opacity-80">{movimiento.notas_cobro}</span>
                )}
              </>
            ) : (
              <>
                <strong>Pendiente de cobro.</strong> Lo tiene que devolver el
                propietario de {movimiento.depto?.codigo}.
              </>
            )}
          </div>
          {movimiento.fecha_cobro ? (
            <form action={desmarcarCobro.bind(null, id)}>
              <button
                type="submit"
                className="rounded-lg border border-emerald-800 px-3 py-1.5 text-xs hover:bg-emerald-900/40"
              >
                Volver a pendiente
              </button>
            </form>
          ) : (
            <Link
              href="/caja/por-cobrar"
              className="rounded-lg border border-amber-800 px-3 py-1.5 text-xs hover:bg-amber-900/40"
            >
              Registrar cobro
            </Link>
          )}
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Comprobantes
        </h2>
        <Comprobantes
          archivos={comprobantes}
          subir={subirComprobante.bind(null, id)}
          ocultar={ocultarComprobante.bind(null, id)}
        />
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Editar
        </h2>
        <FormularioMovimiento
          accion={async (_previo, fd) => {
            "use server";
            return editarMovimiento(id, fd);
          }}
          valores={{
            fecha: movimiento.fecha,
            tipo: movimiento.tipo as "ingreso" | "egreso",
            monto: String(movimiento.monto),
            categoria_id: movimiento.categoria?.id ?? "",
            depto_id: movimiento.depto?.id ?? "",
            descripcion: movimiento.descripcion ?? "",
            reembolsable: movimiento.reembolsable,
            usd_cambiado:
              movimiento.usd_cambiado === null ? "" : String(movimiento.usd_cambiado),
            tc_cambio:
              movimiento.tc_cambio === null ? "" : String(movimiento.tc_cambio),
          }}
          categorias={categorias ?? []}
          departamentos={departamentos ?? []}
          esAlta={false}
          urlCancelar="/caja"
        />
      </section>

      {movimiento.activo && (
        <form action={anularMovimiento.bind(null, id)}>
          <button
            type="submit"
            className="rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-slate-800 hover:text-red-300"
          >
            Anular movimiento
          </button>
        </form>
      )}
    </main>
  );
}
