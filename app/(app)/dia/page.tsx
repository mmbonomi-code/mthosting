import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import { formatearHora } from "@/lib/limpiezas/etiquetas";
import { faltantesDeEvento } from "@/lib/eventos/faltantes";
import { momentoDeEvento } from "@/lib/eventos/reglas";
import { puedeEditarReservas } from "@/lib/reservas/permisos";
import { describirAcceso, esAccesoPresencial } from "@/lib/eventos/etiquetas";
import { TONO_LIMPIEZA, TONO_RESERVA } from "@/lib/estados";
import Badge from "@/app/componentes/Badge";
import { clsBoton } from "@/app/componentes/Boton";
import BuscadorDia from "./BuscadorDia";
import NavegadorFecha from "./NavegadorFecha";
import AvisosDelDia from "./AvisosDelDia";

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
    depto:departamentos(codigo, nombre_interno, direccion, barrio, requiere_registro, requiere_aviso_seguridad)
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
    registro_hecho: boolean;
    aviso_seguridad_hecho: boolean;
    depto: {
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
 * El día en el que figura el evento es SIEMPRE el de la reserva de Airbnb.
 * Coordinar la llegada para otro día no lo mueve de lugar: se sigue
 * trabajando sobre el día contractual, y la fecha acordada se muestra
 * aparte con la marca "Movido".
 */
function fechaOperativa(e: Evento): string | null {
  return e.tipo === "checkin"
    ? (e.reserva?.fecha_checkin ?? null)
    : (e.reserva?.fecha_checkout ?? null);
}

function Fila({ evento }: { evento: Evento }) {
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
  const faltantes = faltantesDeEvento({
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
  const coordinado = faltantes.length === 0;

  return (
    <li>
      <Link
        href={`/dia/${evento.id}`}
        /* Una sola alarma por fila: lo que le falta algo toma el fondo del
           acento y el filete; el detalle va abajo en texto, sin badge que
           repita la misma señal. */
        className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-borde border-l-[3px] px-4 py-3 transition-colors ${
          coordinado
            ? "border-l-primary bg-superficie hover:bg-superficie-hover"
            : "border-l-accent bg-accent-soft"
        }`}
      >
        <span className="w-16 shrink-0">
          <span className="block font-mono text-base font-semibold tabular-nums text-tinta">
            {hora ?? "—"}
          </span>
          {fechaEvento && (
            <span className="block text-xs tabular-nums text-tinta-tenue">
              {formatearFechaAR(fechaEvento).slice(0, 5)}
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          {/* Lo importante: qué departamento y cómo se coordinó el acceso.
              El lápiz va FUERA de lo que se recorta: es una señal, y una
              señal que a veces aparece y a veces no según el largo del
              texto no sirve para nada. */}
          <span className="flex items-baseline gap-1">
            <span className="min-w-0 flex-1 truncate font-mono text-sm font-semibold text-tinta">
              {r.depto?.codigo}
              {/* Acento cuando va una persona, verde cuando el huésped entra
                  solo: de un vistazo se ve qué ocupa al equipo. */}
              {textoAcceso && (
                <span
                  className={`font-sans font-semibold ${
                    accesoPresencial ? "text-accent" : "text-exito"
                  }`}
                >
                  {" "}
                  · {textoAcceso}
                </span>
              )}
            </span>
            {/* Hay algo escrito en las observaciones: se avisa acá para que
                no haya que entrar a cada ficha a buscarlo. */}
            {evento.observaciones && (
              <span
                title={evento.observaciones}
                className="shrink-0 text-base leading-none text-dato"
              >
                ✎
              </span>
            )}
          </span>
          <span className="block truncate text-sm text-tinta-suave">
            {r.huesped_nombre ?? "Sin nombre"}
            {r.depto?.barrio && ` · ${r.depto.barrio}`}
          </span>
          {/* Los pendientes, a la vista: es lo que hay que resolver, y es la
              razón por la que esta fila está marcada. Va en el acento pleno
              y en negrita, no atenuado. */}
          {!coordinado && (
            <span className="mt-0.5 block text-xs font-semibold text-accent">
              {faltantes.join(" · ")}
            </span>
          )}
        </span>
        <span className="flex shrink-0 flex-wrap justify-end gap-1">
          {/* Vino del calendario y todavía no la confirmó el archivo de
              Airbnb: faltan el teléfono y los datos del huésped. El borde
              punteado la distingue sin depender del color. */}
          {!r.datos_completos && (
            <Badge tono={TONO_RESERVA.tentativa}>Tentativa</Badge>
          )}
          {coordinado && <Badge tono={TONO_LIMPIEZA.hecha}>Coordinado</Badge>}
          {evento.late_checkout && (
            <Badge tono={TONO_LIMPIEZA.en_curso}>Late</Badge>
          )}
          {movido && <Badge tono={TONO_RESERVA.en_curso}>Movido</Badge>}
          {r.cancelada && <Badge tono={TONO_RESERVA.cancelada}>Cancelada</Badge>}
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

  let eventos: Evento[] = [];

  if (q) {
    // Búsqueda libre: no importa el día, importa encontrar la reserva.
    const patron = `%${q}%`;
    const { data: reservas } = await supabase
      .from("reservas")
      .select("id")
      .or(
        `codigo_reserva.ilike.${patron},huesped_nombre.ilike.${patron},huesped_contacto.ilike.${patron}`,
      )
      .eq("descartada", false)
      .limit(40);

    const { data: porDepto } = await supabase
      .from("departamentos")
      .select("id")
      .or(`codigo.ilike.${patron},nombre_interno.ilike.${patron}`)
      .limit(20);

    const idsReserva = (reservas ?? []).map((r) => r.id);
    const idsDepto = (porDepto ?? []).map((d) => d.id);

    if (idsReserva.length > 0 || idsDepto.length > 0) {
      let consulta = supabase.from("eventos_estadia").select(CAMPOS).limit(80);
      if (idsDepto.length > 0 && idsReserva.length > 0) {
        const { data: masReservas } = await supabase
          .from("reservas")
          .select("id")
          .in("depto_id", idsDepto)
          .eq("descartada", false)
          .gte("fecha_checkout", hoy)
          .limit(40);
        consulta = consulta.in("reserva_id", [
          ...new Set([...idsReserva, ...(masReservas ?? []).map((r) => r.id)]),
        ]);
      } else if (idsDepto.length > 0) {
        const { data: masReservas } = await supabase
          .from("reservas")
          .select("id")
          .in("depto_id", idsDepto)
          .eq("descartada", false)
          .gte("fecha_checkout", hoy)
          .limit(40);
        consulta = consulta.in("reserva_id", (masReservas ?? []).map((r) => r.id));
      } else {
        consulta = consulta.in("reserva_id", idsReserva);
      }
      const { data } = await consulta;
      eventos = ((data ?? []) as unknown as Evento[]).filter((e) => !e.reserva?.descartada);
    }
  } else {
    // El día operativo es el de la reserva de Airbnb, siempre.
    const { data } = await supabase
      .from("eventos_estadia")
      .select(CAMPOS)
      .or(`fecha_checkin.eq.${fecha},fecha_checkout.eq.${fecha}`, {
        referencedTable: "reservas",
      })
      .neq("estado", "cancelado");

    eventos = ((data ?? []) as unknown as Evento[]).filter(
      (e) => e.reserva && !e.reserva.descartada && fechaOperativa(e) === fecha,
    );
  }

  // Se ordena por el momento acordado, no por la hora suelta: las 02:00 del
  // día siguiente van al fondo, no al principio.
  const momento = (e: Evento) =>
    momentoDeEvento({
      fechaCoordinada: e.fecha_coordinada,
      horaCoordinada: e.hora_coordinada,
      fechaContractual: fechaOperativa(e),
    });

  const ordenar = (a: Evento, b: Evento) =>
    momento(a).localeCompare(momento(b)) ||
    (a.reserva?.depto?.codigo ?? "").localeCompare(b.reserva?.depto?.codigo ?? "");

  const llegadas = eventos.filter((e) => e.tipo === "checkin").sort(ordenar);
  const salidas = eventos.filter((e) => e.tipo === "checkout").sort(ordenar);

  const sinCoordinar = eventos.filter(
    (e) => !e.hora_coordinada || (!e.punto && !e.responsable && !e.punto_devolucion && !e.responsable_devolucion),
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <BuscadorDia q={q} fecha={fecha} />

      {q ? (
        <p className="text-sm tabular-nums text-tinta-suave">
          {eventos.length} resultado{eventos.length === 1 ? "" : "s"} para
          &ldquo;{q}&rdquo;
        </p>
      ) : (
        <>
          <NavegadorFecha fecha={fecha} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[28px] font-semibold capitalize leading-tight tracking-tight text-tinta">
                {nombreDelDia(fecha)}{" "}
                <span className="tabular-nums">{formatearFechaAR(fecha)}</span>
                {fecha === hoy && (
                  <span className="ml-2 rounded-full bg-warm-100 px-2 py-0.5 align-middle text-xs font-medium text-warm-600">
                    hoy
                  </span>
                )}
              </h1>
              {/* El resumen antes del detalle: lo que falta coordinar se ve
                  sin recorrer las dos listas. */}
              <p className="text-sm tabular-nums text-tinta-suave">
                {llegadas.length} llegada{llegadas.length === 1 ? "" : "s"} ·{" "}
                {salidas.length} salida{salidas.length === 1 ? "" : "s"}
                {sinCoordinar > 0 && (
                  <span className="font-medium text-accent-soft-text">
                    {" "}
                    · {sinCoordinar} sin coordinar
                  </span>
                )}
              </p>
            </div>
            {puedeEditar && (
              <Link
                href={`/reservas/nueva?fecha=${fecha}`}
                className={`shrink-0 ${clsBoton("primario")}`}
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
        <div className="rounded-md border border-borde bg-superficie px-6 py-12 text-center shadow-sm">
          <p className="text-tinta-suave">
            {q ? "No se encontró nada con esa búsqueda." : "No hay movimientos este día."}
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-2">
            <h2 className="border-b border-borde pb-1 font-semibold text-tinta">
              Llegadas
              <span className="ml-2 text-sm font-normal tabular-nums text-tinta-tenue">
                {llegadas.length}
              </span>
            </h2>
            {llegadas.length === 0 ? (
              <p className="py-3 text-sm text-tinta-tenue">Sin llegadas.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {llegadas.map((e) => (
                  <Fila key={e.id} evento={e} />
                ))}
              </ul>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="border-b border-borde pb-1 font-semibold text-tinta">
              Salidas
              <span className="ml-2 text-sm font-normal tabular-nums text-tinta-tenue">
                {salidas.length}
              </span>
            </h2>
            {salidas.length === 0 ? (
              <p className="py-3 text-sm text-tinta-tenue">Sin salidas.</p>
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
