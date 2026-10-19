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
import LlavesPendientes from "./LlavesPendientes";
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
  // Vacía, una sola línea: no tiene sentido gastar pantalla en "no hay nada".
  if (cantidad === 0) {
    return (
      <p className="text-sm text-tinta-apagada">
        <span className="font-medium text-tinta-tenue">{titulo}</span> · {vacio}
      </p>
    );
  }
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-tinta-tenue">
        {titulo}
        <span className="ml-2 font-normal tabular-nums text-tinta-etiqueta">{cantidad}</span>
      </h2>
      {/* Una sola tarjeta con filas, no una tarjeta por depto: en el
          celular entran tres veces más (pedido del dueño, 19/10/2026). */}
      <ul className={`${clsTarjeta} divide-y divide-borde`}>{children}</ul>
    </section>
  );
}

/**
 * Una fila: el depto y sus datos a la izquierda, lo que se marca a la
 * derecha. Lo ya hecho se atenúa, para que lo que falta salte a la vista.
 */
function Fila({
  hecha,
  children,
  acciones,
}: {
  hecha?: boolean;
  children: React.ReactNode;
  acciones: React.ReactNode;
}) {
  return (
    <li className={`flex items-center gap-2 px-3 py-2 ${hecha ? "opacity-60" : ""}`}>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-start gap-1.5">{acciones}</div>
    </li>
  );
}

/** El código del depto, con un toque a su ficha: encargado, cómo se entra. */
function Codigo({ depto }: { depto: { id: string; codigo: string } | null }) {
  if (!depto) return <span className="font-semibold text-tinta">Sin departamento</span>;
  return (
    <Link href={`/departamentos/${depto.id}`} className="font-semibold text-tinta hover:text-primary">
      {depto.codigo}
    </Link>
  );
}

/** Una línea de texto chico que se corta si no entra. */
function Linea({ children }: { children: React.ReactNode }) {
  return <p className="truncate text-xs text-tinta-tenue">{children}</p>;
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
  // En el orden del día, y las ya dejadas al final: arriba, lo que falta.
  const candados = llegadas
    .filter(esLlegadaConCandado)
    .sort((a, b) => Number(a.acceso_dejado) - Number(b.acceso_dejado));
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
  // que llegar antes. Las que ya tienen blanco Y sucio, al final.
  const interacciones = await traerInteracciones(supabase, limpiezasCrudas ?? []);
  const ropaLista = (l: { blanco_entregado_at: string | null; sucio_retirado_at: string | null }) =>
    !!l.blanco_entregado_at && !!l.sucio_retirado_at;
  const limpiezas = [...(limpiezasCrudas ?? [])].sort(
    (a, b) =>
      Number(ropaLista(a)) - Number(ropaLista(b)) ||
      claveOrden(interacciones.get(a.id)!).localeCompare(claveOrden(interacciones.get(b.id)!)) ||
      (a.depto?.codigo ?? "").localeCompare(b.depto?.codigo ?? ""),
  );

  const notas = notasCrudas ?? [];

  const esHoy = fecha === hoy;
  const esManana = fecha === manana;

  const flecha =
    "flex size-11 items-center justify-center rounded-lg border border-borde-control text-tinta-suave transition-colors hover:bg-elevada";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
      {/* Guarda las fotos de llaves sacadas sin señal y las sube cuando vuelve. */}
      <LlavesPendientes>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-tinta">Logística</h1>
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

        <Seccion titulo="Llaves en candado" cantidad={candados.length} vacio="ninguna este día.">
          {candados.map((e) => (
            <Fila
              key={e.id}
              hecha={e.acceso_dejado}
              acciones={
                <DejarLlave
                  eventoId={e.id}
                  hecha={e.acceso_dejado}
                  hora={horaARDe(e.acceso_dejado_at)}
                  fotoUrl={e.acceso_foto ? (urlDeFoto.get(e.acceso_foto) ?? null) : null}
                />
              }
            >
              <p className="text-sm">
                <span className="mr-1.5 font-semibold tabular-nums text-tinta">
                  {formatearHora(e.hora_coordinada) ?? "—"}
                </span>
                <Codigo depto={e.reserva?.depto ?? null} />
              </p>
              <p className="truncate text-xs text-tinta-media">
                Candado
                {e.punto?.ubicacion && <> · {e.punto.ubicacion}</>}
                {e.punto?.identificador && (
                  <span className="font-mono font-semibold text-tinta"> {e.punto.identificador}</span>
                )}
              </p>
              <Linea>
                {[e.reserva?.depto?.direccion, e.punto?.instrucciones].filter(Boolean).join(" · ")}
              </Linea>
            </Fila>
          ))}
        </Seccion>

        <Seccion titulo="Cunas y sillas" cantidad={equipos.length} vacio="nada para llevar ni retirar.">
          {equipos.map((e) => (
            <Fila
              key={`${e.id}-${e.tarea.accion}`}
              hecha={e.tarea.hecha}
              acciones={
                <MarcaEquipamiento
                  id={e.id}
                  accion={e.tarea.accion}
                  hecha={e.tarea.hecha}
                  bloqueada={e.tarea.bloqueada}
                />
              }
            >
              <p className="text-sm">
                <Codigo depto={e.depto} />
                <span className="ml-1.5 text-tinta-media">{ETIQUETA_TIPO[e.tipo as TipoEquipamiento]}</span>
              </p>
              <Linea>{[e.depto?.direccion, e.notas].filter(Boolean).join(" · ")}</Linea>
            </Fila>
          ))}
        </Seccion>

        <Seccion titulo="Ropa blanca" cantidad={limpiezas.length} vacio="no hay limpiezas este día.">
          {limpiezas.map((l) => {
            const { salida, entrada } = interacciones.get(l.id)!;
            const otroDiaEntrada = entrada ? null : diaProximaEntrada(l.prox_checkin, fecha);
            return (
              <Fila
                key={l.id}
                hecha={ropaLista(l)}
                acciones={
                  <>
                    <MarcaRopa limpiezaId={l.id} que="blanco" hora={horaARDe(l.blanco_entregado_at)} />
                    <MarcaRopa limpiezaId={l.id} que="sucio" hora={horaARDe(l.sucio_retirado_at)} />
                  </>
                }
              >
                <p className="text-sm">
                  <Codigo depto={l.depto} />
                </p>
                <p className="text-xs tabular-nums text-tinta-media">
                  {/* Si salió otro día, la hora ya no importa: lo sucio está
                      ahí desde entonces. Así la línea entra en un renglón. */}
                  {salida?.otroDia ? (
                    <span className="font-semibold text-tinta">
                      Salió {formatearFechaAR(salida.otroDia).slice(0, 5)}
                    </span>
                  ) : (
                    <>
                      Sale <span className="font-semibold text-tinta">{salida?.hora ?? "—"}</span>
                    </>
                  )}
                  {" · "}
                  {/* Entra alguien ese día: el color de "pasando ahora",
                      como en Mis limpiezas. No hay margen. */}
                  <span className={entrada ? "text-ahora-text" : undefined}>
                    Entra{" "}
                    <span className={`font-semibold ${entrada ? "text-ahora-text-fuerte" : "text-tinta"}`}>
                      {entrada?.hora ?? (otroDiaEntrada ? otroDiaEntrada : "—")}
                    </span>
                  </span>
                </p>
                <Linea>
                  {/* Quién limpia primero: si la línea se corta, que se
                      corte la dirección, que está a un toque en la ficha. */}
                  {[
                    l.responsable?.nombre ? `limpia ${l.responsable.nombre}` : "sin asignar",
                    l.depto?.direccion,
                    TIPOS_LIMPIEZA[l.tipo] ?? l.tipo,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Linea>
              </Fila>
            );
          })}
        </Seccion>

        <Seccion
          titulo={persona.rol === "logistica" ? "Mis pendientes del reporte" : "Pendientes de logística"}
          cantidad={notas.length}
          vacio="nada pendiente."
        >
          {notas.map((n) => (
            <li key={n.id} className="px-3 py-2 text-sm">
              <p className="text-tinta">
                {n.fecha && (
                  <span
                    className={`mr-1.5 text-xs tabular-nums ${
                      n.fecha <= hoy ? "font-semibold text-aviso-text" : "text-tinta-etiqueta"
                    }`}
                  >
                    {n.fecha < hoy ? "Vencido " : ""}
                    {n.fecha === hoy ? "Hoy" : formatearFechaAR(n.fecha).slice(0, 5)}
                  </span>
                )}
                {n.depto?.codigo && <span className="font-medium text-exito-text">{n.depto.codigo} · </span>}
                {n.titulo}
              </p>
              {n.detalle && <Linea>{n.detalle}</Linea>}
            </li>
          ))}
        </Seccion>
      </LlavesPendientes>
    </main>
  );
}
