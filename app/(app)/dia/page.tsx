import { clsBoton } from "@/lib/ui";
import Link from "next/link";
import Badge from "@/app/componentes/Badge";
import { ETIQUETA_MARCA, TONO_MARCA } from "@/lib/estados";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import { formatearHora } from "@/lib/limpiezas/etiquetas";
import { faltantesDeEvento } from "@/lib/eventos/faltantes";
import {
  eventosDelDia,
  fechaOperativa,
  listoParaLlegadas,
  ordenarEventos,
  patronBusqueda,
} from "@/lib/eventos/dia";
import { puedeEditarReservas } from "@/lib/reservas/permisos";
import { describirAcceso, esAccesoPresencial } from "@/lib/eventos/etiquetas";
import BuscadorDia from "./BuscadorDia";
import NavegadorFecha from "./NavegadorFecha";
import AvisosDelDia from "./AvisosDelDia";
import MarcaCalendario from "@/app/componentes/MarcaCalendario";
import type { EstadoCambio, TipoCambio } from "@/lib/ical/cambios";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function nombreDelDia(fechaISO: string): string {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

const CAMPOS = `
  id, tipo, fecha_coordinada, hora_coordinada, estado, late_checkout, acceso_dejado, observaciones,
  punto:puntos_acceso!eventos_estadia_punto_acceso_id_fkey(metodo, ubicacion, identificador),
  punto_devolucion:puntos_acceso!eventos_estadia_punto_devolucion_id_fkey(metodo, ubicacion, identificador),
  responsable:personas!eventos_estadia_responsable_id_fkey(nombre),
  responsable_devolucion:personas!eventos_estadia_responsable_devolucion_id_fkey(nombre),
  reserva:reservas!inner(
    id, codigo_reserva, huesped_nombre, huesped_contacto, noches, adultos, ninos, bebes,
    fecha_checkin, fecha_checkout, cancelada, descartada, datos_completos, origen,
    registro_hecho, aviso_seguridad_hecho,
    cambios:cambios_calendario(tipo, estado),
    depto:departamentos(id, codigo, nombre_interno, direccion, barrio, requiere_registro, requiere_aviso_seguridad)
  )
`;

type Evento = {
  id: string;
  tipo: "checkin" | "checkout";
  fecha_coordinada: string | null;
  hora_coordinada: string | null;
  estado: string;
  late_checkout: boolean;
  acceso_dejado: boolean;
  observaciones: string | null;
  punto: { metodo: string; ubicacion: string | null; identificador: string | null } | null;
  punto_devolucion: {
    metodo: string;
    ubicacion: string | null;
    identificador: string | null;
  } | null;
  responsable: { nombre: string } | null;
  responsable_devolucion: { nombre: string } | null;
  reserva: {
    id: string;
    codigo_reserva: string;
    huesped_nombre: string | null;
    huesped_contacto: string | null;
    noches: number | null;
    adultos: number | null;
    ninos: number | null;
    bebes: number | null;
    fecha_checkin: string | null;
    fecha_checkout: string | null;
    cancelada: boolean;
    descartada: boolean;
    datos_completos: boolean;
    origen: string;
    cambios: { tipo: TipoCambio; estado: EstadoCambio }[] | null;
    registro_hecho: boolean;
    aviso_seguridad_hecho: boolean;
    depto: {
      id: string;
      codigo: string;
      nombre_interno: string;
      direccion: string | null;
      barrio: string | null;
      requiere_registro: boolean;
      requiere_aviso_seguridad: boolean;
    } | null;
  } | null;
};

/**
 * Lo que falta para dar el evento por coordinado. La misma cuenta pinta la
 * fila y suma el "sin coordinar" de arriba: si no, podían no coincidir.
 */
function faltantesDeFila(evento: Evento): string[] {
  const r = evento.reserva!;
  const esLlegada = evento.tipo === "checkin";
  const punto = esLlegada ? evento.punto : evento.punto_devolucion;
  const persona = esLlegada ? evento.responsable : evento.responsable_devolucion;
  return faltantesDeEvento({
    tipo: evento.tipo,
    horaCoordinada: evento.hora_coordinada,
    acceso: punto
      ? { clase: "punto", metodo: punto.metodo }
      : persona
        ? { clase: "persona" }
        : null,
    accesoDejado: evento.acceso_dejado,
    requiereRegistro: r.depto?.requiere_registro ?? false,
    registroHecho: r.registro_hecho,
    requiereAviso: r.depto?.requiere_aviso_seguridad ?? false,
    avisoHecho: r.aviso_seguridad_hecho,
  });
}

function Fila({ evento, listo }: { evento: Evento; listo?: boolean }) {
  const r = evento.reserva!;
  const esLlegada = evento.tipo === "checkin";
  const punto = esLlegada ? evento.punto : evento.punto_devolucion;
  const persona = esLlegada ? evento.responsable : evento.responsable_devolucion;
  const textoAcceso = describirAcceso(punto, persona);
  const accesoPresencial = esAccesoPresencial(punto, persona);
  const hora = formatearHora(evento.hora_coordinada);
  const fechaEvento =
    evento.fecha_coordinada ?? (esLlegada ? r.fecha_checkin : r.fecha_checkout);
  const movido =
    evento.fecha_coordinada &&
    evento.fecha_coordinada !== (esLlegada ? r.fecha_checkin : r.fecha_checkout);

  // Lo que falta se calcula acá: no hace falta entrar a la ficha para saberlo.
  const faltantes = faltantesDeFila(evento);
  const coordinado = faltantes.length === 0;

  return (
    <li>
      <Link
        href={`/dia/${evento.id}`}
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-y border-r border-y-borde border-r-borde border-l-4 bg-superficie px-4 py-3 transition-colors hover:border-y-borde-fuerte hover:border-r-borde-fuerte ${
          coordinado ? "border-l-exito" : "border-l-aviso"
        }`}
      >
        <span className="w-20 shrink-0">
          <span className="block text-base font-semibold tabular-nums text-tinta">
            {hora ?? "—"}
            {/* Las marcas van en esta columna, que no se corta nunca: al
                final del nombre del depto quedaban afuera cuando el depto y
                el acceso eran largos. */}
            {listo && (
              <span
                title="Departamento listo: ya se limpió después de la última salida"
                className="ml-1.5 font-normal text-exito-text"
              >
                ✓<span className="sr-only"> Departamento listo</span>
              </span>
            )}
            {evento.observaciones && (
              <span title={evento.observaciones} className="ml-1.5 font-normal text-dato-text">
                ✎<span className="sr-only"> Tiene observaciones</span>
              </span>
            )}
          </span>
          {fechaEvento && (
            <span className="block text-xs tabular-nums text-tinta-etiqueta">
              {formatearFechaAR(fechaEvento).slice(0, 5)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          {/* Lo importante: qué departamento y cómo se coordinó el acceso */}
          <span className="block truncate font-medium text-tinta">
            {r.depto?.codigo}
            {/* Amarillo cuando va una persona, verde cuando el huésped entra
                solo: de un vistazo se ve qué ocupa al equipo. */}
            {textoAcceso && (
              <span
                className={`font-normal ${
                  accesoPresencial ? "text-aviso-text" : "text-exito-text"
                }`}
              >
                {" "}
                · {textoAcceso}
              </span>
            )}
          </span>
          <span className="block truncate text-sm text-tinta-tenue">
            {r.huesped_nombre ?? "Sin nombre"}
            {r.depto?.barrio && ` · ${r.depto.barrio}`}
          </span>
          {/* Los pendientes, a la vista, igual que el "Late" */}
          {!coordinado && (
            <span className="mt-0.5 block text-xs text-aviso-text">
              {faltantes.join(" · ")}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {/* Vino del calendario y todavía no la confirmó el archivo de
              Airbnb: faltan el teléfono y los datos del huésped. */}
          {!r.datos_completos && (
            <Badge tono={TONO_MARCA.tentativa}>{ETIQUETA_MARCA.tentativa}</Badge>
          )}
          <MarcaCalendario cambios={r.cambios} />
          {coordinado && (
            <Badge tono={TONO_MARCA.coordinado}>{ETIQUETA_MARCA.coordinado}</Badge>
          )}
          {evento.late_checkout && (
            <Badge tono={TONO_MARCA.late}>{ETIQUETA_MARCA.late}</Badge>
          )}
          {movido && (
            <Badge tono={TONO_MARCA.movido}>{ETIQUETA_MARCA.movido}</Badge>
          )}
          {r.cancelada && (
            <Badge tono={TONO_MARCA.cancelada}>{ETIQUETA_MARCA.cancelada}</Badge>
          )}
        </span>
      </Link>
    </li>
  );
}

export default async function DelDia({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; q?: string }>;
}) {
  const params = await searchParams;
  const hoy = hoyAR();
  const fecha = params.fecha ?? hoy;
  const q = (params.q ?? "").trim();

  const supabase = await crearClienteServidor();
  const puedeEditar = await puedeEditarReservas(supabase);

  let llegadas: Evento[] = [];
  let salidas: Evento[] = [];

  if (q) {
    // Búsqueda libre: no importa el día, importa encontrar la reserva.
    const patron = patronBusqueda(q);
    const [{ data: reservas }, { data: porDepto }] = await Promise.all([
      supabase
        .from("reservas")
        .select("id")
        .or(
          `codigo_reserva.ilike.${patron},huesped_nombre.ilike.${patron},huesped_contacto.ilike.${patron}`,
        )
        .eq("descartada", false)
        .limit(40),
      supabase
        .from("departamentos")
        .select("id")
        .or(`codigo.ilike.${patron},nombre_interno.ilike.${patron}`)
        .limit(20),
    ]);

    const idsReserva = (reservas ?? []).map((r) => r.id);
    const idsDepto = (porDepto ?? []).map((d) => d.id);

    // De un depto, las estadías que siguen abiertas: de hoy en adelante.
    const { data: delDepto } =
      idsDepto.length > 0
        ? await supabase
            .from("reservas")
            .select("id")
            .in("depto_id", idsDepto)
            .eq("descartada", false)
            .gte("fecha_checkout", hoy)
            .limit(40)
        : { data: [] as { id: string }[] };

    const ids = [...new Set([...idsReserva, ...(delDepto ?? []).map((r) => r.id)])];
    if (ids.length > 0) {
      const { data } = await supabase
        .from("eventos_estadia")
        .select(CAMPOS)
        .in("reserva_id", ids)
        .limit(80);
      ({ llegadas, salidas } = ordenarEventos(
        ((data ?? []) as unknown as Evento[]).filter((e) => !e.reserva?.descartada),
      ));
    }
  } else {
    // El día operativo es el de la reserva de Airbnb, siempre.
    ({ llegadas, salidas } = await eventosDelDia<Evento>(supabase, fecha, CAMPOS));
  }

  const eventos = [...llegadas, ...salidas];

  // "Departamento listo" para cada llegada (spec §3.5.bis), con la misma
  // cuenta que la ficha.
  const listoPorEvento = await listoParaLlegadas(
    supabase,
    llegadas.flatMap((e) => {
      const deptoId = e.reserva?.depto?.id;
      const fechaLlegada = fechaOperativa(e);
      return deptoId && fechaLlegada ? [{ eventoId: e.id, deptoId, fechaLlegada }] : [];
    }),
  );

  const sinCoordinar = eventos.filter((e) => faltantesDeFila(e).length > 0).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <BuscadorDia q={q} fecha={fecha} />

      {q ? (
        <p className="text-sm text-tinta-tenue">
          {eventos.length} resultado{eventos.length === 1 ? "" : "s"} para
          &ldquo;{q}&rdquo;
        </p>
      ) : (
        <>
          <NavegadorFecha fecha={fecha} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold capitalize tracking-tight text-tinta">
                {nombreDelDia(fecha)} {formatearFechaAR(fecha)}
                {fecha === hoy && (
                  <span className="ml-2 rounded-full bg-elevada-hover px-2 py-0.5 align-middle text-xs font-normal text-tinta-media">
                    hoy
                  </span>
                )}
              </h1>
              <p className="text-sm text-tinta-tenue">
                {llegadas.length} llegada{llegadas.length === 1 ? "" : "s"} ·{" "}
                {salidas.length} salida{salidas.length === 1 ? "" : "s"}
                {sinCoordinar > 0 && ` · ${sinCoordinar} sin coordinar`}
              </p>
            </div>
            {puedeEditar && (
              <Link
                href={`/reservas/nueva?fecha=${fecha}`}
                className={`${clsBoton("secundario", "chico")} shrink-0`}
              >
                + Reserva
              </Link>
            )}
          </div>
        </>
      )}

      {/* Lo del Reporte que toca hoy: avisos vigentes y cunas a llevar. */}
      {!q && <AvisosDelDia fecha={fecha} />}

      {eventos.length === 0 ? (
        <div className="rounded-xl border border-borde bg-superficie px-6 py-12 text-center">
          <p className="text-tinta-suave">
            {q ? "No se encontró nada con esa búsqueda." : "No hay movimientos este día."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h2 className="border-b border-borde pb-1 font-medium text-tinta">
              Llegadas
              <span className="ml-2 text-sm font-normal text-tinta-etiqueta">
                {llegadas.length}
              </span>
            </h2>
            {llegadas.length === 0 ? (
              <p className="py-3 text-sm text-tinta-apagada">Sin llegadas.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {llegadas.map((e) => (
                  <Fila key={e.id} evento={e} listo={listoPorEvento.get(e.id)} />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="border-b border-borde pb-1 font-medium text-tinta">
              Salidas
              <span className="ml-2 text-sm font-normal text-tinta-etiqueta">
                {salidas.length}
              </span>
            </h2>
            {salidas.length === 0 ? (
              <p className="py-3 text-sm text-tinta-apagada">Sin salidas.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {salidas.map((e) => (
                  <Fila key={e.id} evento={e} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
