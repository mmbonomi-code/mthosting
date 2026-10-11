import { crearClienteServidor } from "@/lib/supabase/server";
import { clsPastilla, clsTitulo } from "@/lib/ui";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import Tarjeta from "@/app/componentes/Tarjeta";
import { consultarRanking, type ResenaFloja } from "@/lib/calidad/consultar";
import { resolverPeriodo } from "@/lib/calidad/periodo";
import { LIMPIEZA_BAJA, MINIMO_RESENAS_RANKING, type FilaRanking } from "@/lib/calidad/ranking";
import SelectorPeriodo from "../SelectorPeriodo";

const puntaje = (n: number) => n.toFixed(2).replace(".", ",");
/** "PATRICIA" → "Patricia". */
const nombrePropio = (n: string) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();

function Dato({ etiqueta, valor, aviso = false }: { etiqueta: string; valor: string; aviso?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className={`text-base font-semibold tabular-nums ${aviso ? "text-aviso-text" : "text-tinta-media"}`}>
        {valor}
      </span>
      <span className="text-xs text-tinta-etiqueta">{etiqueta}</span>
    </div>
  );
}

function Floja({ r }: { r: ResenaFloja }) {
  return (
    <li className="flex flex-col gap-1 border-t border-borde py-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="font-mono text-tinta">{r.depto}</span>
        <span className="text-tinta-tenue tabular-nums">
          {formatearFechaAR(r.fecha_checkin)} → {formatearFechaAR(r.fecha_checkout)}
        </span>
        <span
          className={`${clsPastilla} ${
            r.puntaje_limpieza !== null && r.puntaje_limpieza <= LIMPIEZA_BAJA
              ? "bg-error-soft text-error-text"
              : "bg-elevada text-tinta-suave"
          }`}
        >
          Limpieza {r.puntaje_limpieza ?? "—"}
        </span>
        <span className="text-xs text-tinta-etiqueta">general {r.puntaje_general}</span>
      </div>
      {r.quejas.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {r.quejas.map((q) => (
            <span key={q} className={`${clsPastilla} bg-error-soft text-error-text`}>
              {q}
            </span>
          ))}
        </div>
      )}
      {r.comentario_privado && (
        <p className="text-tinta-suave">
          <span className="mr-2 text-xs uppercase tracking-wide text-tinta-etiqueta">Privado</span>
          {r.comentario_privado}
        </p>
      )}
      <p className="text-xs text-tinta-etiqueta">
        Limpieza del {r.limpieza_fecha ? formatearFechaAR(r.limpieza_fecha) : "—"} ·{" "}
        {r.origen === "sistema" ? "asignada en el sistema" : "según el listado histórico"}
      </p>
    </li>
  );
}

function Persona({
  fila,
  posicion,
  flojas,
}: {
  fila: FilaRanking;
  posicion: number | null;
  flojas: ResenaFloja[];
}) {
  return (
    <Tarjeta>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex min-w-40 items-baseline gap-3">
          <span className="w-6 text-right text-sm tabular-nums text-tinta-etiqueta">
            {posicion ?? "·"}
          </span>
          <span className="text-lg font-semibold text-tinta">{nombrePropio(fila.nombre)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-2xl font-semibold tabular-nums text-tinta">{puntaje(fila.promedio)}</span>
          <span className="text-xs text-tinta-etiqueta">limpieza</span>
        </div>
        <Dato etiqueta="reseñas" valor={String(fila.resenas)} />
        <Dato etiqueta="con 5" valor={`${Math.round(fila.cinco)} %`} />
        <Dato etiqueta={`con ${LIMPIEZA_BAJA} o menos`} valor={String(fila.bajas)} aviso={fila.bajas > 0} />
        <Dato etiqueta="con queja" valor={String(fila.conQueja)} aviso={fila.conQueja > 0} />
      </div>
      {flojas.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-tinta-tenue hover:text-tinta">
            Ver las {flojas.length} {flojas.length === 1 ? "reseña" : "reseñas"} que bajan el puntaje
          </summary>
          <ul className="mt-2">
            {flojas.map((r) => (
              <Floja key={r.id} r={r} />
            ))}
          </ul>
        </details>
      )}
    </Tarjeta>
  );
}

/** Ranking del personal de limpieza (docs/CALIDAD-ESPECIFICACION.md §5.2). */
export default async function RankingLimpieza({
  searchParams,
}: {
  searchParams: Promise<{ p?: string; desde?: string; hasta?: string }>;
}) {
  const periodo = resolverPeriodo(await searchParams, hoyAR());
  const supabase = await crearClienteServidor();
  const { enOrden, pocas, sinAtribuir, flojas } = await consultarRanking(supabase, periodo);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className={clsTitulo}>Ranking de limpieza</h1>
        <p className="text-sm text-tinta-tenue">
          Cada reseña cuenta para quien hizo la limpieza anterior a la estadía.
        </p>
      </div>

      <SelectorPeriodo periodo={periodo} ruta="/calidad/limpieza" />

      {enOrden.length === 0 && pocas.length === 0 ? (
        <p className="rounded-xl border border-borde bg-superficie px-6 py-8 text-tinta-suave">
          No hay reseñas con responsable de limpieza con check-out entre el{" "}
          {formatearFechaAR(periodo.desde)} y el {formatearFechaAR(periodo.hasta)}.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {enOrden.map((f, i) => (
            <Persona key={f.persona_id} fila={f} posicion={i + 1} flojas={flojas.get(f.persona_id) ?? []} />
          ))}
        </div>
      )}

      {pocas.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-tinta">Con menos de {MINIMO_RESENAS_RANKING} reseñas</h2>
          <p className="text-xs text-tinta-etiqueta">
            Sin posición: con tan pocas reseñas el promedio todavía no dice mucho.
          </p>
          {pocas.map((f) => (
            <Persona key={f.persona_id} fila={f} posicion={null} flojas={flojas.get(f.persona_id) ?? []} />
          ))}
        </section>
      )}

      {sinAtribuir > 0 && (
        <p className="text-sm text-tinta-etiqueta">
          {sinAtribuir} {sinAtribuir === 1 ? "reseña del período no tiene" : "reseñas del período no tienen"}{" "}
          responsable: ni el sistema ni el listado histórico dicen quién hizo la limpieza anterior.
        </p>
      )}
    </main>
  );
}
