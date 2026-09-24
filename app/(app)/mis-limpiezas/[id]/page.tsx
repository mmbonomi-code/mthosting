import { clsBoton } from "@/lib/ui";
import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerMisLimpiezas, miPersonaId } from "@/lib/limpiezas/permisos";
import { rolDelUsuario } from "@/lib/permisos";
import { diasSinLimpiar, tareaPeriodicaVencida } from "@/lib/limpiezas/diasSinLimpiar";
import { calcularQueLlevar } from "@/lib/limpiezas/quellevar";
import { AYUDA_FOTO, ETIQUETA_FOTO, TIPOS_FOTO } from "@/lib/limpiezas/fotos";
import ReporteTexto from "../ReporteTexto";
import { limpiezasAnteriores } from "@/lib/limpiezas/ultimaLimpieza";
import { TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import { traerInteracciones } from "@/lib/limpiezas/interaccion-db";
import { formatearFechaAR } from "@/lib/fechas";
import InteraccionHuespedes from "../InteraccionHuespedes";
import SinPermiso from "@/app/componentes/SinPermiso";
import ItemChecklist from "../ItemChecklist";
import SubidorFotos from "../SubidorFotos";
import AlTerminar from "../AlTerminar";
import PendientesProvider from "../PendientesProvider";
import {
  crearArreglo,
  guardarDanioHuesped,
  finalizarLimpieza,
  iniciarLimpieza,
  subirComprobanteViatico,
} from "../acciones";
import { BUCKET } from "../tipos";

const CAMPOS = `
  id, depto_id, reserva_id, rol_reserva, fecha, estado, tipo, asignado_a, urgente,
  observacion_proxima, danio_huesped, viatico_monto, viatico_comprobante, monto_pactado, moneda,
  prox_checkin, hora_checkout,
  depto:departamentos(id, codigo, barrio, direccion, url_mapa, camas_king, camas_queen, camas_twin, capacidad),
  reserva:reservas(id, noches, fecha_checkin, fecha_checkout)
`;

/** Genera el checklist de esta limpieza la primera vez que se abre. Después queda fijo. */
async function asegurarChecklist(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  limpiezaId: string,
) {
  const { count } = await supabase
    .from("limpieza_checklist")
    .select("id", { count: "exact", head: true })
    .eq("limpieza_id", limpiezaId)
    .eq("activo", true);
  if (count && count > 0) return;

  const [{ data: items }, { data: periodicas }] = await Promise.all([
    supabase.from("checklist_catalogo").select("seccion, item").eq("activo", true).order("orden"),
    supabase.from("tareas_periodicas_catalogo").select("id, item").eq("activo", true).order("orden"),
  ]);

  const filas = [
    ...(items ?? []).map((i) => ({
      limpieza_id: limpiezaId,
      seccion: i.seccion,
      item: i.item,
      hecho: false,
    })),
    ...(periodicas ?? []).map((p) => ({
      limpieza_id: limpiezaId,
      seccion: "Periódica",
      item: p.item,
      hecho: false,
      tarea_periodica_id: p.id,
    })),
  ];
  if (filas.length === 0) return;

  // Si la pantalla se carga dos veces casi a la vez (pasa en el celular), las
  // dos llegan acá. La base no deja repetir un ítem, así que la segunda choca
  // y no inserta nada: el checklist ya lo creó la primera. Antes quedaba
  // entero dos veces (12 limpiezas al 18/09/2026).
  const { error } = await supabase.from("limpieza_checklist").insert(filas);
  if (error && error.code !== "23505") throw new Error(error.message);
}

/**
 * Hace cuántos días se hizo cada tarea periódica en este depto, la última vez
 * antes de esta limpieza. Null si no hay registro.
 *
 * Va por `periodicas_del_depto()`: cuenta lo que hizo cualquier persona, no
 * solo quien mira (decisión del dueño, 24/09/2026). Con la tabla, RLS le
 * escondía a la limpiadora las tareas hechas por otra, y se las marcaba
 * vencidas. Una sola consulta para todas las tareas.
 */
async function diasDesdePeriodicas(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  tareaIds: string[],
  limpiezaId: string,
  fechaReferencia: string,
): Promise<Map<string, number | null>> {
  const ultima = new Map<string, string>();
  if (tareaIds.length > 0) {
    const { data, error } = await supabase.rpc("periodicas_del_depto", {
      p_limpieza_id: limpiezaId,
    });
    if (error) throw new Error(`No se pudieron leer las tareas periódicas: ${error.message}`);
    for (const fila of data ?? []) ultima.set(fila.tarea_periodica_id, fila.fecha);
  }
  return new Map(
    tareaIds.map((id) => {
      const fecha = ultima.get(id);
      return [id, fecha ? diasSinLimpiar(fecha, fechaReferencia) : null];
    }),
  );
}

export default async function DetalleMiLimpieza({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  if (!(await puedeVerMisLimpiezas(supabase))) {
    return <SinPermiso titulo="Mis limpiezas" motivo="Esta pantalla es para el personal que limpia." />;
  }

  const [miId, rol] = await Promise.all([miPersonaId(supabase), rolDelUsuario(supabase)]);

  const { data: limpieza } = await supabase.from("limpiezas").select(CAMPOS).eq("id", id).maybeSingle();
  if (!limpieza || !limpieza.depto) notFound();

  // El personal de limpieza solo ve lo suyo (spec §3.8); el resto de los
  // roles que llegan hasta acá ya pasaron el permiso general de arriba.
  if (rol === "limpieza" && limpieza.asignado_a !== miId) {
    return (
      <SinPermiso titulo="Mis limpiezas" motivo="Esta limpieza no está asignada a vos." />
    );
  }

  await asegurarChecklist(supabase, id);

  const depto = limpieza.depto;

  const [
    { count: cantidadBanos },
    interacciones,
    anterior,
    { data: checklistFilas },
    { data: tareasActivas },
    { data: fotosCrudas },
  ] = await Promise.all([
    supabase.from("banos_depto").select("id", { count: "exact", head: true }).eq("depto_id", depto.id),
    traerInteracciones(supabase, [limpieza]),
    limpiezasAnteriores(supabase, [id]).then((m) => m.get(id) ?? null),
    supabase
      .from("limpieza_checklist")
      .select("id, seccion, item, hecho, tarea_periodica_id")
      .eq("limpieza_id", id)
      .eq("activo", true)
      .order("seccion")
      .order("item"),
    supabase
      .from("tareas_periodicas_catalogo")
      .select("id, item, frecuencia_dias")
      .eq("activo", true)
      .order("orden"),
    supabase.from("limpieza_fotos").select("id, tipo, storage_path").eq("limpieza_id", id),
  ]);

  const diasPorTarea = await diasDesdePeriodicas(
    supabase,
    (tareasActivas ?? []).map((t) => t.id),
    id,
    limpieza.fecha,
  );
  const tareasConDias = (tareasActivas ?? []).map((t) => ({
    ...t,
    dias: diasPorTarea.get(t.id) ?? null,
  }));
  const periodicasVencidas = tareasConDias.filter((t) => tareaPeriodicaVencida(t.dias, t.frecuencia_dias));

  const diasSin = diasSinLimpiar(anterior?.fecha ?? null, limpieza.fecha);

  const queLlevar = calcularQueLlevar({
    camasKing: depto.camas_king,
    camasQueen: depto.camas_queen,
    camasTwin: depto.camas_twin,
    capacidad: depto.capacidad,
    cantidadBanos: cantidadBanos ?? 0,
  });

  const interaccion = interacciones.get(limpieza.id)!;
  // Si nadie entra ese día, igual sirve saber cuándo llega el próximo.
  const proximaEntradaFecha = limpieza.prox_checkin?.slice(0, 10) ?? null;
  const proximaOtroDia =
    !interaccion.entrada && proximaEntradaFecha && proximaEntradaFecha > limpieza.fecha
      ? proximaEntradaFecha
      : null;

  const mapsUrl =
    depto.url_mapa ??
    (depto.direccion
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(depto.direccion)}`
      : null);

  // Agrupadas por sección, en el orden en que llegaron (fijo primero, luego periódicas).
  const porSeccion = new Map<string, NonNullable<typeof checklistFilas>>();
  for (const f of checklistFilas ?? []) {
    if (f.tarea_periodica_id) continue; // las periódicas se muestran aparte, con su chip
    porSeccion.set(f.seccion, [...(porSeccion.get(f.seccion) ?? []), f]);
  }
  const filasPeriodicas = (checklistFilas ?? []).filter((f) => f.tarea_periodica_id);
  const hechos = (checklistFilas ?? []).filter((f) => f.hecho).length;

  const rutasFotos = (fotosCrudas ?? []).map((f) => f.storage_path);
  const { data: firmadas } =
    rutasFotos.length > 0
      ? await supabase.storage.from(BUCKET).createSignedUrls(rutasFotos, 3600)
      : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlPorRuta = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
  const fotosPorTipo = (tipo: string) =>
    (fotosCrudas ?? [])
      .filter((f) => f.tipo === tipo)
      .map((f) => ({ id: f.id, url: urlPorRuta.get(f.storage_path) ?? null }));

  const monedaMonto = limpieza.moneda ?? "ARS";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <PendientesProvider>
      <Link href="/mis-limpiezas" className="text-sm text-tinta-tenue hover:text-tinta">
        ← Todas mis limpiezas
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">{depto.codigo}</h1>
        <p className="text-sm text-tinta-tenue">
          {depto.barrio} · {TIPOS_LIMPIEZA[limpieza.tipo] ?? limpieza.tipo}
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-borde-control bg-superficie p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-etiqueta">Cómo llegar</h2>
        <p className="text-tinta-media">{depto.direccion ?? "Sin dirección cargada"}</p>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center rounded-lg border border-borde-fuerte text-tinta-media transition-colors hover:bg-elevada-hover"
          >
            📍 Abrir en Google Maps
          </a>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-borde-control bg-superficie p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-etiqueta">
          Ventana y carga de trabajo
        </h2>
        <InteraccionHuespedes interaccion={interaccion} />
        {proximaOtroDia && (
          <div className="flex justify-between text-sm">
            <span className="text-tinta-tenue">Próxima entrada</span>
            <span className="font-medium tabular-nums text-tinta-media">
              {formatearFechaAR(proximaOtroDia)}
            </span>
          </div>
        )}
        {limpieza.reserva?.noches != null && (
          <div className="flex justify-between text-sm">
            <span className="text-tinta-tenue">Duró la estadía</span>
            <span className="font-medium text-tinta-media">{limpieza.reserva.noches} noches</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-tinta-tenue">Días sin limpiarse</span>
          <span className="font-medium text-tinta-media">
            {diasSin === null ? "sin limpiezas previas" : `${diasSin} días`}
          </span>
        </div>
        {(limpieza.reserva?.noches ?? 0) >= 10 && (
          <p className="rounded-lg bg-aviso-soft/50 px-3 py-2 text-sm text-aviso-text">
            ⚠ Estadía larga: puede llevar más tiempo de lo habitual.
          </p>
        )}
        {interaccion.entrada && (
          <p className="rounded-lg bg-ahora-soft/50 px-3 py-2 text-sm font-medium text-ahora-text">
            Entra alguien nuevo el mismo día. No hay margen: priorizá este depto.
          </p>
        )}
      </section>

      {queLlevar.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-borde-control bg-superficie p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-etiqueta">Qué llevar</h2>
          <ul className="flex flex-col">
            {queLlevar.map((q) => (
              <li key={q.item} className="flex justify-between border-t border-borde py-2 first:border-t-0">
                <span className="text-tinta-media">{q.item}</span>
                <span className="font-semibold text-tinta">{q.cantidad}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-borde-control bg-superficie p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-etiqueta">
          De la limpieza anterior
        </h2>
        {anterior ? (
          <p className="text-sm text-tinta-tenue">Última vez: {anterior.fecha}</p>
        ) : (
          <p className="text-sm text-tinta-etiqueta">No hay una limpieza anterior de este depto.</p>
        )}
        {periodicasVencidas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {periodicasVencidas.map((t) => (
              <p key={t.id} className="rounded-lg bg-dato-soft/50 px-3 py-2 text-sm text-dato-text">
                <strong>{t.item}:</strong>{" "}
                {t.dias === null ? "nunca se hizo" : `hace ${t.dias} días (cada ${t.frecuencia_dias})`} —
                dale una pasada.
              </p>
            ))}
          </div>
        )}
        {anterior?.observacion_proxima && (
          <p className="rounded-lg bg-fondo/60 px-3 py-2 text-sm italic text-tinta-suave">
            &quot;{anterior.observacion_proxima}&quot;
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-borde-control bg-superficie p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-tinta-etiqueta">Checklist</h2>
          <span className="text-xs text-tinta-etiqueta">
            {hechos}/{(checklistFilas ?? []).length}
          </span>
        </div>

        {filasPeriodicas.length > 0 && (
          <div className="flex flex-col">
            <p className="pt-1 text-sm font-medium text-tinta-suave">Periódicas</p>
            {filasPeriodicas.map((f) => {
              const tarea = tareasConDias.find((t) => t.id === f.tarea_periodica_id);
              const chip = tarea
                ? tarea.dias === null
                  ? "nunca se hizo"
                  : `hace ${tarea.dias} días · cada ${tarea.frecuencia_dias}`
                : null;
              return (
                <ItemChecklist
                  key={f.id}
                  etiqueta={f.item}
                  hechoInicial={f.hecho}
                  chip={chip}
                  limpiezaId={id}
                  filaId={f.id}
                />
              );
            })}
          </div>
        )}

        {[...porSeccion.entries()].map(([seccion, filas]) => (
          <div key={seccion} className="flex flex-col">
            <p className="pt-2 text-sm font-medium text-tinta-suave">{seccion}</p>
            {filas.map((f) => (
              <ItemChecklist
                key={f.id}
                etiqueta={f.item}
                hechoInicial={f.hecho}
                limpiezaId={id}
                filaId={f.id}
              />
            ))}
          </div>
        ))}
      </section>

      {limpieza.estado === "asignada" && (
        <form action={iniciarLimpieza.bind(null, id)}>
          <button
            type="submit"
            className={`${clsBoton("primario", "grande")} w-full`}
          >
            Iniciar limpieza
          </button>
        </form>
      )}

      {limpieza.estado === "en_curso" && (
        <>
          {TIPOS_FOTO.map((t) => (
            <SubidorFotos
              key={t}
              fotos={fotosPorTipo(t)}
              limpiezaId={id}
              tipo={t}
              etiqueta={ETIQUETA_FOTO[t]}
              ayuda={AYUDA_FOTO[t]}
            >
              {/* El texto va pegado a la foto, no al final de la pantalla:
                  son las dos mitades del mismo reporte. */}
              {t === "arreglar" && (
                <ReporteTexto
                  accion={crearArreglo.bind(null, id, depto.id)}
                  placeholder="¿Qué hay que arreglar? Ej: la persiana del dormitorio no cierra bien…"
                  boton="Reportar"
                  enviando="Reportando…"
                />
              )}
              {t === "huesped" && (
                <ReporteTexto
                  accion={guardarDanioHuesped.bind(null, id)}
                  placeholder="¿Qué dejó mal? Ej: quemaron el acolchado de la cama grande con un cigarrillo…"
                  boton="Guardar"
                  enviando="Guardando…"
                  valorInicial={limpieza.danio_huesped ?? ""}
                />
              )}
            </SubidorFotos>
          ))}

          <AlTerminar
            limpiezaId={id}
            observacionInicial={limpieza.observacion_proxima ?? ""}
            viaticoInicial={limpieza.viatico_monto?.toString() ?? ""}
            monedaMonto={monedaMonto}
            subirComprobanteViatico={subirComprobanteViatico.bind(null, id)}
            finalizarLimpieza={finalizarLimpieza.bind(null, id)}
            puedeFinalizar={fotosPorTipo("terminado").length > 0}
          />
        </>
      )}

      {(limpieza.estado === "hecha" || limpieza.estado === "verificada") && (
        <>
          {TIPOS_FOTO.map((t) =>
            fotosPorTipo(t).length > 0 ? (
              <SubidorFotos
                key={t}
                fotos={fotosPorTipo(t)}
                limpiezaId={id}
                tipo={t}
                etiqueta={ETIQUETA_FOTO[t]}
              >
                {t === "huesped" && limpieza.danio_huesped && (
                  <p className="whitespace-pre-wrap rounded-lg bg-fondo/60 px-3 py-2 text-sm text-tinta-suave">
                    {limpieza.danio_huesped}
                  </p>
                )}
              </SubidorFotos>
            ) : null,
          )}
          <p className="rounded-lg bg-exito-soft/60 px-4 py-3 text-center text-sm font-medium text-exito-text">
            ✓ Esta limpieza ya está terminada.
            {limpieza.monto_pactado != null &&
              ` Cobrás ${monedaMonto} ${limpieza.monto_pactado.toLocaleString("es-AR")}.`}
          </p>
        </>
      )}
      </PendientesProvider>
    </main>
  );
}
