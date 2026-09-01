import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerMisLimpiezas, miPersonaId } from "@/lib/limpiezas/permisos";
import { rolDelUsuario } from "@/lib/permisos";
import { diasSinLimpiar, tareaPeriodicaVencida } from "@/lib/limpiezas/diasSinLimpiar";
import { calcularQueLlevar } from "@/lib/limpiezas/quellevar";
import { AYUDA_FOTO, ETIQUETA_FOTO, TIPOS_FOTO } from "@/lib/limpiezas/fotos";
import { ultimaLimpiezaDelDepto } from "@/lib/limpiezas/ultimaLimpieza";
import { formatearHora, TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import SinPermiso from "@/app/componentes/SinPermiso";
import ItemChecklist from "../ItemChecklist";
import SubidorFotos from "../SubidorFotos";
import AlTerminar from "../AlTerminar";
import PendientesProvider from "../PendientesProvider";
import {
  crearArreglo,
  finalizarLimpieza,
  iniciarLimpieza,
  subirComprobanteViatico,
} from "../acciones";
import { BUCKET } from "../tipos";

const CAMPOS = `
  id, depto_id, reserva_id, rol_reserva, fecha, estado, tipo, asignado_a, urgente,
  observacion_proxima, viatico_monto, viatico_comprobante, monto_pactado, moneda,
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
    .eq("limpieza_id", limpiezaId);
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
  if (filas.length > 0) await supabase.from("limpieza_checklist").insert(filas);
}

/** Hace cuántos días se hizo esta tarea periódica en este depto, la última vez. */
async function diasDesdePeriodica(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  tareaId: string,
  deptoId: string,
  limpiezaId: string,
  fechaReferencia: string,
): Promise<number | null> {
  const { data } = await supabase
    .from("limpieza_checklist")
    .select("limpieza:limpiezas!inner(fecha, depto_id)")
    .eq("tarea_periodica_id", tareaId)
    .eq("hecho", true)
    .eq("limpieza.depto_id", deptoId)
    .neq("limpieza_id", limpiezaId)
    .order("fecha", { referencedTable: "limpiezas", ascending: false })
    .limit(1)
    .maybeSingle();

  const fechaUltima = data?.limpieza?.fecha;
  return fechaUltima ? diasSinLimpiar(fechaUltima, fechaReferencia) : null;
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
    { data: eventoCheckout },
    { data: proximaReserva },
    anterior,
    { data: checklistFilas },
    { data: tareasActivas },
    { data: fotosCrudas },
  ] = await Promise.all([
    supabase.from("banos_depto").select("id", { count: "exact", head: true }).eq("depto_id", depto.id),
    limpieza.reserva_id
      ? supabase
          .from("eventos_estadia")
          .select("hora_coordinada")
          .eq("reserva_id", limpieza.reserva_id)
          .eq("tipo", "checkout")
          .maybeSingle()
      : Promise.resolve({ data: null }),
    limpieza.prox_checkin
      ? supabase
          .from("reservas")
          .select(
            `id, fecha_checkin, eventos:eventos_estadia(
               tipo, hora_coordinada,
               punto:puntos_acceso!eventos_estadia_punto_acceso_id_fkey(recibe_limpieza)
             )`,
          )
          .eq("depto_id", depto.id)
          .eq("cancelada", false)
          .eq("descartada", false)
          .eq("fecha_checkin", limpieza.prox_checkin.slice(0, 10))
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    ultimaLimpiezaDelDepto(supabase, depto.id, limpieza.fecha, id),
    supabase
      .from("limpieza_checklist")
      .select("id, seccion, item, hecho, tarea_periodica_id")
      .eq("limpieza_id", id)
      .order("seccion")
      .order("item"),
    supabase
      .from("tareas_periodicas_catalogo")
      .select("id, item, frecuencia_dias")
      .eq("activo", true)
      .order("orden"),
    supabase.from("limpieza_fotos").select("id, tipo, storage_path").eq("limpieza_id", id),
  ]);

  const tareasConDias = await Promise.all(
    (tareasActivas ?? []).map(async (t) => ({
      ...t,
      dias: await diasDesdePeriodica(supabase, t.id, depto.id, id, limpieza.fecha),
    })),
  );
  const periodicasVencidas = tareasConDias.filter((t) => tareaPeriodicaVencida(t.dias, t.frecuencia_dias));

  const diasSin = diasSinLimpiar(anterior?.fecha ?? null, limpieza.fecha);

  const queLlevar = calcularQueLlevar({
    camasKing: depto.camas_king,
    camasQueen: depto.camas_queen,
    camasTwin: depto.camas_twin,
    capacidad: depto.capacidad,
    cantidadBanos: cantidadBanos ?? 0,
  });

  const horaSalida = formatearHora(eventoCheckout?.hora_coordinada ?? limpieza.hora_checkout);
  const proximaEntradaFecha = limpieza.prox_checkin?.slice(0, 10) ?? null;
  const esHoyMismo = proximaEntradaFecha === limpieza.fecha;
  const entrada = proximaReserva?.eventos?.find((e) => e.tipo === "checkin");
  const horaEntrada = formatearHora(entrada?.hora_coordinada ?? null);

  // El huésped que llega deja las valijas con la limpieza: tienen que saberlo
  // antes de llegar. Si quedan en el edificio o en la oficina, no se avisa.
  const recibeValijas = esHoyMismo && (entrada?.punto?.recibe_limpieza ?? false);

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
      <Link href="/mis-limpiezas" className="text-sm text-slate-400 hover:text-white">
        ← Todas mis limpiezas
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{depto.codigo}</h1>
        <p className="text-sm text-slate-400">
          {depto.barrio} · {TIPOS_LIMPIEZA[limpieza.tipo] ?? limpieza.tipo}
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cómo llegar</h2>
        <p className="text-slate-200">{depto.direccion ?? "Sin dirección cargada"}</p>
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-11 items-center justify-center rounded-lg border border-slate-600 text-slate-200 transition-colors hover:bg-slate-700"
          >
            📍 Abrir en Google Maps
          </a>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Ventana y carga de trabajo
        </h2>
        {horaSalida && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Sale el huésped</span>
            <span className="font-medium text-slate-200">{horaSalida}</span>
          </div>
        )}
        {proximaEntradaFecha && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Próxima entrada</span>
            <span className="font-medium text-slate-200">
              {esHoyMismo ? `${horaEntrada ?? ""} (mismo día)`.trim() : proximaEntradaFecha}
            </span>
          </div>
        )}
        {limpieza.reserva?.noches != null && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Duró la estadía</span>
            <span className="font-medium text-slate-200">{limpieza.reserva.noches} noches</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-slate-400">Días sin limpiarse</span>
          <span className="font-medium text-slate-200">
            {diasSin === null ? "sin limpiezas previas" : `${diasSin} días`}
          </span>
        </div>
        {recibeValijas && (
          <p className="rounded-lg bg-sky-950/60 px-3 py-2 text-sm text-sky-200">
            🧳 El huésped que llega{horaEntrada ? ` a las ${horaEntrada}` : ""} deja
            las valijas con vos.
          </p>
        )}
        {(limpieza.reserva?.noches ?? 0) >= 10 && (
          <p className="rounded-lg bg-amber-950/50 px-3 py-2 text-sm text-amber-300">
            ⚠ Estadía larga: puede llevar más tiempo de lo habitual.
          </p>
        )}
        {limpieza.urgente && (
          <p className="rounded-lg bg-orange-950/50 px-3 py-2 text-sm font-medium text-orange-300">
            Entra alguien nuevo el mismo día. No hay margen: priorizá este depto.
          </p>
        )}
      </section>

      {queLlevar.length > 0 && (
        <section className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Qué llevar</h2>
          <ul className="flex flex-col">
            {queLlevar.map((q) => (
              <li key={q.item} className="flex justify-between border-t border-slate-800 py-2 first:border-t-0">
                <span className="text-slate-200">{q.item}</span>
                <span className="font-semibold text-white">{q.cantidad}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          De la limpieza anterior
        </h2>
        {anterior ? (
          <p className="text-sm text-slate-400">Última vez: {anterior.fecha}</p>
        ) : (
          <p className="text-sm text-slate-500">No hay una limpieza anterior de este depto.</p>
        )}
        {periodicasVencidas.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {periodicasVencidas.map((t) => (
              <p key={t.id} className="rounded-lg bg-sky-950/50 px-3 py-2 text-sm text-sky-300">
                <strong>{t.item}:</strong>{" "}
                {t.dias === null ? "nunca se hizo" : `hace ${t.dias} días (cada ${t.frecuencia_dias})`} —
                dale una pasada.
              </p>
            ))}
          </div>
        )}
        {anterior?.observacion_proxima && (
          <p className="rounded-lg bg-slate-900/60 px-3 py-2 text-sm italic text-slate-300">
            &quot;{anterior.observacion_proxima}&quot;
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Checklist</h2>
          <span className="text-xs text-slate-500">
            {hechos}/{(checklistFilas ?? []).length}
          </span>
        </div>

        {filasPeriodicas.length > 0 && (
          <div className="flex flex-col">
            <p className="pt-1 text-sm font-medium text-slate-300">Periódicas</p>
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
            <p className="pt-2 text-sm font-medium text-slate-300">{seccion}</p>
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
            className="h-12 w-full rounded-lg bg-white text-base font-semibold text-slate-900 transition-colors hover:bg-slate-200"
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
            />
          ))}

          <AlTerminar
            limpiezaId={id}
            observacionInicial={limpieza.observacion_proxima ?? ""}
            viaticoInicial={limpieza.viatico_monto?.toString() ?? ""}
            monedaMonto={monedaMonto}
            crearArreglo={crearArreglo.bind(null, id, depto.id)}
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
              />
            ) : null,
          )}
          <p className="rounded-lg bg-emerald-950/60 px-4 py-3 text-center text-sm font-medium text-emerald-300">
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
