import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { clsBotonPrimario, clsPastilla, clsTitulo } from "@/lib/ui";
import { diaARDe, formatearFechaAR, hoyAR } from "@/lib/fechas";
import { Encabezado, Fila, SinFilas, Tabla, Td, Th } from "@/app/componentes/Tabla";
import { consultarCalidad } from "@/lib/calidad/consultar";
import { resolverPeriodo } from "@/lib/calidad/periodo";
import { CATEGORIAS, type Categoria } from "@/lib/calidad/parser";
import { MINIMO_RESENAS_CONFIABLE, UMBRAL_CATEGORIA_FLOJA } from "@/lib/calidad/resumen";
import SelectorPeriodo from "./SelectorPeriodo";

const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  limpieza: "Limpieza",
  veracidad: "Veracidad",
  checkin: "Check-in",
  comunicacion: "Comunic.",
  ubicacion: "Ubicación",
  precio: "Precio",
};

/** 4.7189 → "4,72". */
const puntaje = (n: number | null) => (n === null ? "—" : n.toFixed(2).replace(".", ","));
const porcentaje = (n: number | null) => (n === null ? "—" : `${Math.round(n)} %`);

function Cifra({
  etiqueta,
  valor,
  detalle,
  aviso = false,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  aviso?: boolean;
}) {
  return (
    <div className="rounded-xl border border-borde bg-superficie px-4 py-3">
      <div className="text-xs uppercase tracking-wide text-tinta-etiqueta">{etiqueta}</div>
      <div className={`text-2xl font-semibold tabular-nums ${aviso ? "text-aviso-text" : "text-tinta"}`}>
        {valor}
      </div>
      {detalle && <div className="text-xs text-tinta-etiqueta">{detalle}</div>}
    </div>
  );
}

/**
 * Un promedio en la tabla. Con pocas reseñas va apagado: no se lee igual un
 * 3,0 de dos reseñas que de veinte. Por debajo de 4,5, ámbar: hay que mirarlo.
 */
function CeldaPuntaje({ valor, resenas }: { valor: number | null; resenas: number }) {
  const color =
    valor === null || resenas < MINIMO_RESENAS_CONFIABLE
      ? "text-tinta-etiqueta"
      : valor < UMBRAL_CATEGORIA_FLOJA
        ? "text-aviso-text"
        : "text-tinta-media";
  return <td className={`px-3 py-0 text-right ${color}`}>{puntaje(valor)}</td>;
}

/** Calidad por departamento (docs/CALIDAD-ESPECIFICACION.md §5.1). */
export default async function Calidad({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>;
}) {
  const hoy = hoyAR();
  const periodo = resolverPeriodo(await searchParams, hoy);
  const supabase = await crearClienteServidor();

  const [resumen, { data: ultima }] = await Promise.all([
    consultarCalidad(supabase, periodo, hoy),
    supabase
      .from("importaciones_resenas")
      .select("created_at")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const { total, deptos, quejas, ventanaTasa } = resumen;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={clsTitulo}>Calidad</h1>
          <p className="text-sm text-tinta-tenue">
            Reseñas de Airbnb por fecha de check-out
            {ultima && <> · última carga el {formatearFechaAR(diaARDe(ultima.created_at) ?? "")}</>}
          </p>
        </div>
        <Link href="/calidad/importar" className={clsBotonPrimario}>
          Importar reseñas
        </Link>
      </div>

      <SelectorPeriodo periodo={periodo} ruta="/calidad" />

      {total.resenas === 0 ? (
        <p className="rounded-xl border border-borde bg-superficie px-6 py-8 text-tinta-suave">
          No hay reseñas con check-out entre el {formatearFechaAR(periodo.desde)} y el{" "}
          {formatearFechaAR(periodo.hasta)}.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Cifra etiqueta="Puntaje general" valor={puntaje(total.general)} />
            <Cifra etiqueta="5 estrellas" valor={porcentaje(total.cinco)} />
            <Cifra
              etiqueta="Tasa de reseñas"
              valor={porcentaje(total.tasa.pct)}
              detalle={
                ventanaTasa
                  ? `${total.tasa.conResena} de ${total.tasa.estadias} estadías`
                  : "sin estadías para medir"
              }
            />
            <Cifra etiqueta="Reseñas" valor={String(total.resenas)} />
            <Cifra etiqueta="Con alerta" valor={String(total.alertas)} aviso={total.alertas > 0} />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {CATEGORIAS.map((c) => (
              <div
                key={c}
                className="flex items-center justify-between rounded-lg border border-borde px-3 py-2 text-sm"
              >
                <span className="text-tinta-tenue">{NOMBRE_CATEGORIA[c]}</span>
                <span
                  className={`font-semibold tabular-nums ${
                    (total.categorias[c] ?? 5) < UMBRAL_CATEGORIA_FLOJA ? "text-aviso-text" : "text-tinta"
                  }`}
                >
                  {puntaje(total.categorias[c])}
                </span>
              </div>
            ))}
          </div>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold text-tinta">Por departamento</h2>
            <p className="text-xs text-tinta-etiqueta">
              De peor a mejor. Con menos de {MINIMO_RESENAS_CONFIABLE} reseñas el promedio va
              apagado; por debajo de {puntaje(UMBRAL_CATEGORIA_FLOJA)}, en ámbar.
              {ventanaTasa && (
                <>
                  {" "}
                  La tasa cuenta las estadías con check-out del {formatearFechaAR(ventanaTasa.desde)} al{" "}
                  {formatearFechaAR(ventanaTasa.hasta)}: las de los últimos 14 días todavía pueden
                  recibir su reseña.
                </>
              )}
            </p>
            <Tabla minimo="64rem">
              <Encabezado>
                <Th>Depto</Th>
                <Th derecha>Reseñas</Th>
                <Th derecha>General</Th>
                {CATEGORIAS.map((c) => (
                  <Th key={c} derecha>
                    {NOMBRE_CATEGORIA[c]}
                  </Th>
                ))}
                <Th derecha>Tasa</Th>
                <Th>Queja más repetida</Th>
                <Th derecha>Alertas</Th>
              </Encabezado>
              <tbody>
                {deptos.length === 0 && <SinFilas columnas={12}>Sin departamentos en el período.</SinFilas>}
                {deptos.map((d) => (
                  <Fila key={d.depto_id}>
                    <Td>
                      <span className="font-mono text-tinta">{d.codigo}</span>
                    </Td>
                    <Td derecha tenue>
                      {d.resenas}
                    </Td>
                    <CeldaPuntaje valor={d.general} resenas={d.resenas} />
                    {CATEGORIAS.map((c) => (
                      <CeldaPuntaje key={c} valor={d.categorias[c]} resenas={d.resenas} />
                    ))}
                    <Td derecha tenue>
                      {porcentaje(d.tasa.pct)}
                    </Td>
                    <Td>
                      {d.quejaMasRepetida ? (
                        <span className={`${clsPastilla} bg-error-soft text-error-text`}>
                          {d.quejaMasRepetida.texto}
                          {d.quejaMasRepetida.veces > 1 && ` ×${d.quejaMasRepetida.veces}`}
                        </span>
                      ) : (
                        <span className="text-tinta-etiqueta">—</span>
                      )}
                    </Td>
                    <Td derecha>
                      {d.alertas > 0 ? (
                        <span className={`${clsPastilla} bg-aviso-soft text-aviso-text`}>{d.alertas}</span>
                      ) : null}
                    </Td>
                  </Fila>
                ))}
              </tbody>
            </Tabla>
          </section>

          {quejas.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-tinta">Quejas más repetidas</h2>
              <Tabla minimo="28rem">
                <Encabezado>
                  <Th>Etiqueta negativa</Th>
                  <Th>Categoría</Th>
                  <Th derecha>Veces</Th>
                </Encabezado>
                <tbody>
                  {quejas.slice(0, 12).map((q) => (
                    <Fila key={`${q.categoria}|${q.texto}`}>
                      <Td>{q.texto}</Td>
                      <Td tenue>{NOMBRE_CATEGORIA[q.categoria]}</Td>
                      <Td derecha>{q.veces}</Td>
                    </Fila>
                  ))}
                </tbody>
              </Tabla>
            </section>
          )}
        </>
      )}
    </main>
  );
}
