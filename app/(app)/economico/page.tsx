import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR } from "@/lib/fechas";

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
      <span className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>{valor}</span>
      {detalle && <span className="text-xs text-slate-500">{detalle}</span>}
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="flex flex-col gap-0.5 rounded-lg transition-colors hover:bg-slate-800/60"
      >
        {contenido}
      </Link>
    );
  }
  return <div className="flex flex-col gap-0.5">{contenido}</div>;
}

/**
 * Entrada de la sección. Por ahora dice qué hay cargado y qué falta resolver:
 * el dashboard y la tabla de ganancias vienen en las etapas siguientes.
 */
export default async function Economico() {
  const supabase = await crearClienteServidor();

  const [
    { count: movimientos },
    { data: rango },
    { data: sinMapear },
    { count: cuentasSinClasificar },
    { count: aircover },
    { data: ultima },
  ] = await Promise.all([
    supabase
      .from("movimientos_economicos")
      .select("id", { count: "exact", head: true })
      .eq("activo", true),
    supabase
      .from("movimientos_economicos")
      .select("fecha")
      .eq("activo", true)
      .order("fecha")
      .limit(1),
    supabase
      .from("movimientos_economicos")
      .select("anuncio")
      .eq("activo", true)
      .is("depto_id", null)
      .not("anuncio", "is", null),
    supabase
      .from("cuentas_payout")
      .select("id", { count: "exact", head: true })
      .eq("clasificacion", "sin_clasificar")
      .eq("activo", true),
    supabase
      .from("movimientos_economicos")
      .select("id", { count: "exact", head: true })
      .eq("activo", true)
      .eq("categoria", "aircover")
      .eq("aircover_destino", "sin_asignar"),
    supabase
      .from("importaciones_economico")
      .select("created_at, filas_nuevas")
      .eq("estado", "vigente")
      .not("cerrado_en", "is", null)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const anunciosSinMapear = new Set((sinMapear ?? []).map((m) => m.anuncio)).size;
  const hayDatos = (movimientos ?? 0) > 0;
  const pendientes =
    anunciosSinMapear + (cuentasSinClasificar ?? 0) + (aircover ?? 0);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Económico</h1>
        <p className="text-sm text-slate-400">
          Lo que MTHosting gana y lo que efectivamente cobra, departamento por
          departamento.
        </p>
      </div>

      {!hayDatos ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-12 text-center">
          <p className="text-slate-300">Todavía no hay cobros importados.</p>
          <p className="max-w-md text-sm text-slate-500">
            Se cargan desde Airbnb, en Ganancias → Historial de transacciones. Se
            pueden subir los ~40 archivos de una vez.
          </p>
          <Link
            href="/economico/importar"
            className="rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200"
          >
            Importar cobros
          </Link>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4 sm:grid-cols-4">
            <Numero
              etiqueta="Movimientos"
              valor={(movimientos ?? 0).toLocaleString("es-AR")}
              detalle={
                rango && rango.length > 0
                  ? `desde ${formatearFechaAR(rango[0].fecha)}`
                  : undefined
              }
              color="text-white"
            />
            <Numero
              etiqueta="Anuncios sin mapear"
              valor={String(anunciosSinMapear)}
              detalle={anunciosSinMapear > 0 ? "resolver →" : "todo mapeado"}
              color={anunciosSinMapear > 0 ? "text-amber-300" : "text-slate-400"}
              href="/economico/anuncios"
            />
            <Numero
              etiqueta="Cuentas sin decidir"
              valor={String(cuentasSinClasificar ?? 0)}
              detalle={(cuentasSinClasificar ?? 0) > 0 ? "clasificar →" : "todas listas"}
              color={(cuentasSinClasificar ?? 0) > 0 ? "text-amber-300" : "text-slate-400"}
              href="/economico/cuentas"
            />
            <Numero
              etiqueta="AirCover a asignar"
              valor={String(aircover ?? 0)}
              detalle="reembolsos por daños"
              color={(aircover ?? 0) > 0 ? "text-amber-300" : "text-slate-400"}
            />
          </section>

          {ultima && ultima.length > 0 && (
            <p className="text-sm text-slate-500">
              Última importación: {formatearFechaAR(ultima[0].created_at.slice(0, 10))},{" "}
              {ultima[0].filas_nuevas.toLocaleString("es-AR")} filas nuevas.{" "}
              <Link
                href="/economico/importaciones"
                className="underline underline-offset-4 hover:text-slate-300"
              >
                Ver todas
              </Link>
            </p>
          )}
        </>
      )}

      {/* Honestidad sobre el estado: los números todavía no están calculados,
          y decirlo evita que alguien lea un cero como "no hubo ingresos". */}
      <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
        <p className="mb-1 font-medium text-slate-300">Qué falta</p>
        <p className="text-sm text-slate-500">
          Por ahora esta sección importa y guarda los cobros. La ganancia, lo
          percibido y la brecha por departamento y mes se calculan en la etapa
          siguiente
          {pendientes > 0 && (
            <>
              , y para que cierren hace falta resolver antes las {pendientes} cosas
              pendientes de arriba
            </>
          )}
          .
        </p>
      </div>
    </main>
  );
}
