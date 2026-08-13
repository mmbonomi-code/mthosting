import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR } from "@/lib/fechas";
import VincularAnuncio from "./VincularAnuncio";

/**
 * Bandeja de anuncios sin mapear (spec §3 y §6.5).
 *
 * Una fila cuyo anuncio no se reconoce NO se descarta: se guarda igual y
 * aparece acá. Vincularla crea el alias en `listing_alias` —la misma tabla de
 * las reservas— y reimputa hacia atrás todo lo que ya estaba cargado.
 */
export default async function AnunciosSinMapear() {
  const supabase = await crearClienteServidor();

  const [{ data: filas }, { data: departamentos }] = await Promise.all([
    supabase
      .from("movimientos_economicos")
      .select("anuncio, fecha, importe, moneda")
      .eq("activo", true)
      .is("depto_id", null)
      .not("anuncio", "is", null),
    supabase
      .from("departamentos")
      .select("id, codigo, nombre_interno")
      .eq("activo", true)
      .order("codigo"),
  ]);

  // Agrupado en memoria: son pocos anuncios distintos aunque haya muchas filas.
  const porAnuncio = new Map<
    string,
    { filas: number; desde: string; hasta: string; montos: Map<string, number> }
  >();
  for (const f of filas ?? []) {
    const clave = f.anuncio!;
    const actual = porAnuncio.get(clave) ?? {
      filas: 0,
      desde: f.fecha,
      hasta: f.fecha,
      montos: new Map<string, number>(),
    };
    actual.filas++;
    if (f.fecha < actual.desde) actual.desde = f.fecha;
    if (f.fecha > actual.hasta) actual.hasta = f.fecha;
    actual.montos.set(f.moneda, (actual.montos.get(f.moneda) ?? 0) + (f.importe ?? 0));
    porAnuncio.set(clave, actual);
  }

  const lista = [...porAnuncio.entries()].sort((a, b) => b[1].filas - a[1].filas);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Anuncios sin mapear
        </h1>
        <p className="text-sm text-slate-400">
          Movimientos que se importaron pero todavía no tienen departamento. La plata
          está guardada; lo que falta es decir de quién es.
        </p>
      </div>

      {lista.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-12 text-center">
          <p className="text-slate-300">No quedó ningún anuncio sin departamento.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map(([anuncio, datos]) => (
            <li
              key={anuncio}
              className="flex flex-col gap-3 rounded-xl border border-amber-900/60 bg-slate-800/40 p-4"
            >
              <div>
                <p className="font-medium text-slate-100">{anuncio}</p>
                <p className="text-sm text-slate-500">
                  {datos.filas} movimiento{datos.filas === 1 ? "" : "s"} ·{" "}
                  {formatearFechaAR(datos.desde)} a {formatearFechaAR(datos.hasta)} ·{" "}
                  {[...datos.montos]
                    .map(
                      ([moneda, monto]) =>
                        `${monto.toLocaleString("es-AR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} ${moneda}`,
                    )
                    .join(" · ")}
                </p>
              </div>
              <VincularAnuncio anuncio={anuncio} departamentos={departamentos ?? []} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
