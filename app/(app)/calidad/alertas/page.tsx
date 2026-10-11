import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { clsEnlace, clsPastilla, clsTitulo } from "@/lib/ui";
import { formatearFechaAR } from "@/lib/fechas";
import Tarjeta from "@/app/componentes/Tarjeta";
import { consultarBandeja, type AlertaDetalle } from "@/lib/calidad/consultar";
import { DIAS_ANTES_DE_LA_PRIMERA_CARGA, pideArreglo } from "@/lib/calidad/bandeja";
import { UMBRAL_CATEGORIA, UMBRAL_GENERAL, type MotivoAlerta } from "@/lib/calidad/alertas";
import { CATEGORIAS, type Categoria } from "@/lib/calidad/parser";
import BotonesAlerta from "./BotonesAlerta";

const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  limpieza: "Limpieza",
  veracidad: "Veracidad",
  checkin: "Check-in",
  comunicacion: "Comunicación",
  ubicacion: "Ubicación",
  precio: "Precio",
};

/**
 * Cómo se ve cada motivo. Rojo es lo grave (la general bajó); ámbar, lo que
 * hay que mirar aunque la general esté bien.
 */
const MOTIVO: Record<MotivoAlerta, { texto: (a: AlertaDetalle) => string; filete: string; pastilla: string }> = {
  general_baja: {
    texto: (a) => `General ${a.puntaje_general}`,
    filete: "border-l-error",
    pastilla: "bg-error-soft text-error-text",
  },
  categoria_baja: {
    texto: () => `Categoría en ${UMBRAL_CATEGORIA} o menos`,
    filete: "border-l-aviso",
    pastilla: "bg-aviso-soft text-aviso-text",
  },
  cuatro_con_queja: {
    texto: () => "4 estrellas con queja",
    filete: "border-l-aviso",
    pastilla: "bg-aviso-soft text-aviso-text",
  },
};

const nombrePropio = (n: string) => n.charAt(0).toUpperCase() + n.slice(1).toLowerCase();

function Puntajes({ a }: { a: AlertaDetalle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <span className="rounded-md border border-borde-control px-2 py-0.5 text-xs tabular-nums text-tinta-suave">
        <b className="text-tinta">{a.puntaje_general}</b> general
      </span>
      {CATEGORIAS.map((c) => {
        const p = a.puntajes[c];
        if (p === null) return null;
        const color =
          p <= UMBRAL_CATEGORIA
            ? "border-error-borde bg-error-soft text-error-text"
            : p <= UMBRAL_GENERAL
              ? "border-aviso-borde text-aviso-text"
              : "border-borde-control text-tinta-tenue";
        return (
          <span key={c} className={`rounded-md border px-2 py-0.5 text-xs tabular-nums ${color}`}>
            {p} {NOMBRE_CATEGORIA[c]}
          </span>
        );
      })}
    </div>
  );
}

function Alerta({ a }: { a: AlertaDetalle }) {
  const motivo = MOTIVO[a.motivo];
  const ofrecerArreglo = !!a.depto_id && a.quejas.some((q) => pideArreglo(q.texto));
  return (
    <Tarjeta filete={motivo.filete}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-tinta">{a.depto}</span>
            <span className="text-sm tabular-nums text-tinta-tenue">
              {formatearFechaAR(a.fecha_checkin)} → {formatearFechaAR(a.fecha_checkout)}
            </span>
            {a.huesped && <span className="text-sm text-tinta-tenue">· {a.huesped}</span>}
          </div>
          <span className={`${clsPastilla} ${motivo.pastilla}`}>{motivo.texto(a)}</span>
        </div>

        <Puntajes a={a} />

        {a.quejas.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {a.quejas.map((q) => (
              <span key={`${q.categoria}|${q.texto}`} className={`${clsPastilla} bg-error-soft text-error-text`}>
                {q.texto}
              </span>
            ))}
          </div>
        )}

        {a.resena_publica && (
          <p className="text-sm text-tinta-suave">
            <span className="mr-2 text-xs uppercase tracking-wide text-tinta-etiqueta">Pública</span>
            {a.resena_publica}
          </p>
        )}
        {a.comentario_privado && (
          <p className="text-sm text-tinta-suave">
            <span className="mr-2 text-xs uppercase tracking-wide text-tinta-etiqueta">Privada</span>
            {a.comentario_privado}
          </p>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 border-t border-borde pt-3">
          <p className="text-sm text-tinta-tenue">
            Limpieza anterior:{" "}
            <b className="font-medium text-tinta-media">
              {a.responsable ? nombrePropio(a.responsable) : "sin atribuir"}
            </b>
            {a.limpieza_fecha && <> · {formatearFechaAR(a.limpieza_fecha)}</>}
            {a.origen && (
              <span className="text-tinta-etiqueta">
                {" "}
                ({a.origen === "sistema" ? "sistema" : "listado histórico"})
              </span>
            )}
          </p>
          <BotonesAlerta resenaId={a.id} ofrecerArreglo={ofrecerArreglo} arregloCreado={a.arregloCreado} />
        </div>
      </div>
    </Tarjeta>
  );
}

/** Bandeja de alertas de calidad (docs/CALIDAD-ESPECIFICACION.md §5.3). */
export default async function AlertasCalidad({
  searchParams,
}: {
  searchParams: Promise<{ viejas?: string }>;
}) {
  const incluirViejas = (await searchParams).viejas === "1";
  const supabase = await crearClienteServidor();
  const { alertas, corte, viejas } = await consultarBandeja(supabase, incluirViejas);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className={clsTitulo}>Alertas de calidad</h1>
        <p className="text-sm text-tinta-tenue">
          General de {UMBRAL_GENERAL} o menos, alguna categoría de {UMBRAL_CATEGORIA} o menos, o 4
          estrellas con alguna queja. Al darla por revisada sale de la bandeja; si una carga
          posterior cambia la reseña, vuelve.
        </p>
      </div>

      {alertas.length === 0 ? (
        <p className="rounded-xl border border-borde bg-superficie px-6 py-8 text-tinta-suave">
          No hay alertas de calidad pendientes.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {alertas.map((a) => (
            <Alerta key={a.id} a={a} />
          ))}
        </div>
      )}

      {corte && (
        <p className="text-sm text-tinta-etiqueta">
          {incluirViejas ? (
            <>
              Incluye las reseñas con check-out anterior al {formatearFechaAR(corte)}.{" "}
              <Link href="/calidad/alertas" className={clsEnlace}>
                Ver solo las recientes
              </Link>
            </>
          ) : (
            <>
              Alertan las reseñas con check-out desde el {formatearFechaAR(corte)} ({DIAS_ANTES_DE_LA_PRIMERA_CARGA}{" "}
              días antes de la primera carga), para no arrancar con meses de historia.
              {viejas > 0 && (
                <>
                  {" "}
                  <Link href="/calidad/alertas?viejas=1" className={clsEnlace}>
                    Ver también las {viejas} anteriores
                  </Link>
                </>
              )}
            </>
          )}
        </p>
      )}
    </main>
  );
}
