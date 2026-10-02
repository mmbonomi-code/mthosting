import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { personaActual } from "@/lib/permisos";
import { formatearFechaAR, horaARDe, hoyAR, mananaAR, sumarDias } from "@/lib/fechas";
import { eventosDelDia } from "@/lib/eventos/dia";
import { formatearHora, TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import { traerInteracciones } from "@/lib/limpiezas/interaccion-db";
import { claveOrden } from "@/lib/limpiezas/interaccion";
import { ETIQUETA_TIPO, type EstadoEquipamiento, type TipoEquipamiento } from "@/lib/reporte/equipamiento";
import { BUCKET_LOGISTICA } from "@/lib/logistica/storage";
import {
  diaProximaEntrada,
  esLlegadaConCandado,
  rolPuedeVerLogistica,
  tareasEquipamiento,
} from "@/lib/logistica/tareas";
import { clsTarjeta } from "@/lib/ui";
import SinPermiso from "@/app/componentes/SinPermiso";
import DejarLlave from "./DejarLlave";
import { MarcaEquipamiento, MarcaRopa } from "./Marcas";

/** Hasta dónde se puede mirar para atrás y para adelante. */
const DIAS_ATRAS = 7;
const DIAS_ADELANTE = 7;

// Incluye los de `CAMPOS_SECUENCIA`, que pide `eventosDelDia`.
const CAMPOS_LLEGADA = `
  id, tipo, fecha_coordinada, hora_coordinada,
  acceso_dejado, acceso_dejado_at, acceso_foto,
  punto:puntos_acceso!eventos_estadia_punto_acceso_id_fkey(metodo, ubicacion, identificador, instrucciones),
  reserva:reservas!inner(fecha_checkin, fecha_checkout, descartada, cancelada,
    depto:departamentos(id, codigo, direccion, barrio))
`;

type Llegada = {
  id: string;
  tipo: "checkin" | "checkout";
  fecha_coordinada: string | null;
  hora_coordinada: string | null;
  acceso_dejado: boolean;
  acceso_dejado_at: string | null;
  acceso_foto: string | null;
  punto: {
    metodo: string;
    ubicacion: string | null;
    identificador: string | null;
    instrucciones: string | null;
  } | null;
  reserva: {
    fecha_checkin: string | null;
    fecha_checkout: string | null;
    descartada: boolean;
    cancelada: boolean;
    depto: { id: string; codigo: string; direccion: string | null; barrio: string | null } | null;
  } | null;
};

function Seccion({
  titulo,
  cantidad,
  vacio,
  children,
}: {
  titulo: string;
  cantidad: number;
  vacio: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="border-b border-borde pb-1 font-medium text-tinta">
        {titulo}
        <span className="ml-2 text-sm font-normal tabular-nums text-tinta-etiqueta">{cantidad}</span>
      </h2>
      {cantidad === 0 ? <p className="py-2 text-sm text-tinta-apagada">{vacio}</p> : children}
    </section>
  );
}

/** El departamento, con un toque a su ficha: ahí están el encargado y cómo se entra. */
function Depto({
  depto,
}: {
  depto: { id: string; codigo: string; direccion: string | null; barrio: string | null } | null;
}) {
  if (!depto) return <p className="font-semibold text-tinta">Sin departamento</p>;
  return (
    <div className="min-w-0">
      <Link href={`/departamentos/${depto.id}`} className="text-base font-semibold text-tinta hover:text-primary">
        {depto.codigo}
      </Link>
      {(depto.direccion || depto.barrio) && (
        <p className="truncate text-sm text-tinta-tenue">
          {[depto.direccion, depto.barrio].filter(Boolean).join(" · ")}
        </p>
      )}
    </div>
  );
}

export default async function Logistica({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha: pedida } = await searchParams;
  const supabase = await crearClienteServidor();
  const persona = await personaActual(supabase);

  if (!persona || !rolPuedeVerLogistica(persona.rol)) {
    return (
      <SinPermiso
        titulo="Logística"
        motivo="Esta pantalla es para logística, y para coordinación, manager y administración."
      />
    );
  }

  const hoy = hoyAR();
  const manana = mananaAR();
  const minFecha = sumarDias(hoy, -DIAS_ATRAS);
  const maxFecha = sumarDias(hoy, DIAS_ADELANTE);
  const fecha =
    pedida && /^\d{4}-\d{2}-\d{2}$/.test(pedida) && pedida >= minFecha && pedida <= maxFecha
      ? pedida
      : hoy;

  // Los pendientes del reporte "de logística": los que tiene a su nombre. Si
  // mira alguien del back office, los de todas las personas de logística.
  const responsables =
    persona.rol === "logistica"
      ? [persona.id]
      : (
          (
            await supabase
              .from("personas")
              .select("id")
              .eq("rol", "logistica")
              .eq("activo", true)
          ).data ?? []
        ).map((p) => p.id);

  const [{ llegadas }, { data: limpiezasCrudas }, { data: equiposCrudos }, { data: notasCrudas }] =
    await Promise.all([
      eventosDelDia<Llegada>(supabase, fecha, CAMPOS_LLEGADA),
      supabase
        .from("limpiezas")
        .select(
          `id, tipo, estado, fecha, depto_id, reserva_id, rol_reserva, hora_checkout, prox_checkin,
           blanco_entregado_at, sucio_retirado_at,
           depto:departamentos(id, codigo, direccion, barrio),
           responsable:personas(nombre)`,
        )
        .eq("fecha", fecha)
        .neq("estado", "cancelada")
        .limit(200),
      supabase
        .from("equipamiento_bebe")
        .select(
          `id, tipo, estado, fecha_desde, fecha_hasta, notas,
           depto:departamentos(id, codigo, direccion, barrio)`,
        )
        .eq("activo", true)
        .or(`fecha_desde.eq.${fecha},fecha_hasta.eq.${fecha}`)
        .limit(100),
      responsables.length > 0
        ? supabase
            .from("notas_reporte")
            .select("id, titulo, detalle, fecha, depto:departamentos(id, codigo)")
            .eq("activo", true)
            .eq("estado", "pendiente")
            .in("responsable_id", responsables)
            .order("fecha", { ascending: true, nullsFirst: false })
            .limit(100)
        : Promise.resolve({ data: [] as never[] }),
    ]);

  // --- Llaves ---------------------------------------------------------------
  const candados = llegadas.filter(esLlegadaConCandado);
  const rutasFotos = candados.flatMap((e) => (e.acceso_foto ? [e.acceso_foto] : []));
  const { data: firmadas } =
    rutasFotos.length > 0
      ? await supabase.storage.from(BUCKET_LOGISTICA).createSignedUrls(rutasFotos, 3600)
      : { data: [] };
  const urlDeFoto = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));

  // --- Cunas y sillas -------------------------------------------------------
  const equipos = (equiposCrudos ?? []).flatMap((e) =>
    tareasEquipamiento(
      { estado: e.estado as EstadoEquipamiento, fecha_desde: e.fecha_desde, fecha_hasta: e.fecha_hasta },
      fecha,
    ).map((tarea) => ({ ...e, tarea })),
  );
  // Primero lo que falta, después lo hecho.
  equipos.sort((a, b) => Number(a.tarea.hecha) - Number(b.tarea.hecha));

  // --- Ropa blanca ----------------------------------------------------------
  // Los horarios de salida y entrada, con la misma cuenta que "Mis
  // limpiezas". Primero donde entra alguien, por hora: la ropa blanca tiene
  // que llegar antes.
  const interacciones = await traerInteracciones(supabase, limpiezasCrudas ?? []);
  const limpiezas = [...(limpiezasCrudas ?? [])].sort(
    (a, b) =>
      claveOrden(interacciones.get(a.id)!).localeCompare(claveOrden(interacciones.get(b.id)!)) ||
      (a.depto?.codigo ?? "").localeCompare(b.depto?.codigo ?? ""),
  );

  const notas = notasCrudas ?? [];

  const esHoy = fecha === hoy;
  const esManana = fecha === manana;

  const flecha =
    "flex size-11 items-center justify-center rounded-lg border border-borde-control text-tinta-suave transition-colors hover:bg-elevada";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Logística</h1>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Link
            href={`/logistica?fecha=${sumarDias(fecha, -1)}`}
            aria-label="Día anterior"
            className={`${flecha} ${fecha <= minFecha ? "pointer-events-none opacity-25" : ""}`}
          >
            ←
          </Link>
          <div className="text-center">
            <p className="text-lg font-medium text-tinta">
              {esHoy ? "Hoy" : esManana ? "Mañana" : formatearFechaAR(fecha)}
            </p>
            {!esHoy && (
              <Link href="/logistica" className="text-xs text-tinta-etiqueta hover:text-tinta-suave">
                Volver a hoy
              </Link>
            )}
          </div>
          <Link
            href={`/logistica?fecha=${sumarDias(fecha, 1)}`}
            aria-label="Día siguiente"
            className={`${flecha} ${fecha >= maxFecha ? "pointer-events-none opacity-25" : ""}`}
          >
            →
          </Link>
        </div>
      </div>

      <Seccion titulo="Llaves en candado" cantidad={candados.length} vacio="Ninguna llegada con candado este día.">
        <ul className="flex flex-col gap-3">
          {candados.map((e) => (
            <li key={e.id} className={`${clsTarjeta} flex flex-col gap-3 p-4`}>
              <div className="flex items-start justify-between gap-3">
                <Depto depto={e.reserva?.depto ?? null} />
                <div className="shrink-0 text-right">
                  <p className="text-base font-semibold tabular-nums text-tinta">
                    {formatearHora(e.hora_coordinada) ?? "—"}
                  </p>
                  <p className="text-xs text-tinta-etiqueta">llega</p>
                </div>
              </div>
              <div className="rounded-lg bg-superficie-alt px-3 py-2 text-sm">
                <p className="text-tinta-media">
                  Candado
                  {e.punto?.ubicacion && <> · {e.punto.ubicacion}</>}
                  {e.punto?.identificador && (
                    <span className="font-mono font-semibold text-tinta"> {e.punto.identificador}</span>
                  )}
                </p>
                {e.punto?.instrucciones && (
                  <p className="mt-1 text-xs text-tinta-etiqueta">{e.punto.instrucciones}</p>
                )}
              </div>
              <DejarLlave
                eventoId={e.id}
                hecha={e.acceso_dejado}
                hora={horaARDe(e.acceso_dejado_at)}
                fotoUrl={e.acceso_foto ? (urlDeFoto.get(e.acceso_foto) ?? null) : null}
              />
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Cunas y sillas" cantidad={equipos.length} vacio="No hay que llevar ni retirar nada este día.">
        <ul className="flex flex-col gap-3">
          {equipos.map((e) => (
            <li key={`${e.id}-${e.tarea.accion}`} className={`${clsTarjeta} flex flex-col gap-3 p-4`}>
              <div className="flex items-start justify-between gap-3">
                <Depto depto={e.depto} />
                <p className="shrink-0 text-sm font-medium text-tinta-media">
                  {ETIQUETA_TIPO[e.tipo as TipoEquipamiento]}
                </p>
              </div>
              {e.notas && <p className="text-sm text-tinta-tenue">{e.notas}</p>}
              <MarcaEquipamiento
                id={e.id}
                accion={e.tarea.accion}
                nombre={ETIQUETA_TIPO[e.tipo as TipoEquipamiento].toLowerCase()}
                hecha={e.tarea.hecha}
                bloqueada={e.tarea.bloqueada}
              />
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Ropa blanca" cantidad={limpiezas.length} vacio="No hay limpiezas este día.">
        <ul className="flex flex-col gap-3">
          {limpiezas.map((l) => {
            const { salida, entrada } = interacciones.get(l.id)!;
            const otroDiaEntrada = entrada ? null : diaProximaEntrada(l.prox_checkin, fecha);
            return (
              <li key={l.id} className={`${clsTarjeta} flex flex-col gap-3 p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <Depto depto={l.depto} />
                  <dl className="grid shrink-0 grid-cols-[auto_auto] gap-x-2 text-right text-sm tabular-nums">
                    <dt className="text-tinta-etiqueta">
                      {salida?.otroDia ? `Salió ${formatearFechaAR(salida.otroDia).slice(0, 5)}` : "Sale"}
                    </dt>
                    <dd className="font-semibold text-tinta">{salida?.hora ?? "—"}</dd>
                    {/* Entra alguien ese día: el color de "pasando ahora",
                        como en Mis limpiezas. No hay margen. */}
                    <dt className={entrada ? "text-ahora-text" : "text-tinta-etiqueta"}>Entra</dt>
                    <dd className={`font-semibold ${entrada ? "text-ahora-text-fuerte" : "text-tinta"}`}>
                      {entrada?.hora ?? (otroDiaEntrada ? `el ${otroDiaEntrada}` : "—")}
                    </dd>
                  </dl>
                </div>
                <p className="text-xs text-tinta-etiqueta">
                  {TIPOS_LIMPIEZA[l.tipo] ?? l.tipo}
                  {l.responsable?.nombre ? ` · limpia ${l.responsable.nombre}` : " · sin asignar"}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <MarcaRopa limpiezaId={l.id} que="blanco" hora={horaARDe(l.blanco_entregado_at)} />
                  <MarcaRopa limpiezaId={l.id} que="sucio" hora={horaARDe(l.sucio_retirado_at)} />
                </div>
              </li>
            );
          })}
        </ul>
      </Seccion>

      <Seccion
        titulo={persona.rol === "logistica" ? "Mis pendientes del reporte" : "Pendientes de logística"}
        cantidad={notas.length}
        vacio="Nada pendiente en el reporte."
      >
        <ul className="flex flex-col gap-2">
          {notas.map((n) => (
            <li key={n.id} className={`${clsTarjeta} px-4 py-3 text-sm`}>
              <p className="text-tinta">
                {n.depto?.codigo && <span className="font-medium text-exito-text">{n.depto.codigo} · </span>}
                {n.titulo}
              </p>
              {n.detalle && <p className="mt-0.5 text-tinta-tenue">{n.detalle}</p>}
              {n.fecha && (
                <p
                  className={`mt-1 text-xs tabular-nums ${
                    n.fecha <= hoy ? "text-aviso-text" : "text-tinta-etiqueta"
                  }`}
                >
                  {n.fecha < hoy ? "Vencido · " : n.fecha === hoy ? "Hoy · " : ""}
                  {formatearFechaAR(n.fecha)}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Seccion>
    </main>
  );
}
