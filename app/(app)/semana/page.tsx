import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR, sumarDias } from "@/lib/fechas";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import { TIPOS_LIMPIEZA, formatearHora } from "@/lib/limpiezas/etiquetas";
import {
  BORDE_SEMAFORO,
  FONDO_SEMAFORO,
  cargaPorPersona,
  semaforoDeLimpieza,
} from "@/lib/limpiezas/semaforo";
import { revisarLimpiezas, type EstadiaRevisar } from "@/lib/limpiezas/alertas";
import { TONO_LIMPIEZA, TONO_RESERVA } from "@/lib/estados";
import Badge from "@/app/componentes/Badge";
import { clsBoton } from "@/app/componentes/Boton";
import SelectorResponsable, {
  type PersonaOpcion,
} from "../limpiezas/SelectorResponsable";
import { asignarRapido } from "../limpiezas/acciones";
import NavegadorSemana from "./NavegadorSemana";

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function diaDeLaSemana(fechaISO: string): number {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

const formatearMonto = (monto: number, moneda: string | null) =>
  `${moneda ?? ""} ${monto.toLocaleString("es-AR")}`.trim();

/**
 * La pantalla de las limpiezas (spec §3.2 y §3.3), pensada para el celular:
 * la semana de un vistazo y, al desplegar cada día, sus limpiezas con el
 * desplegable para asignar. La usan la gobernanta y la manager.
 */
export default async function Semana({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; dias?: string }>;
}) {
  const params = await searchParams;
  const hoy = hoyAR();
  const desde = params.desde ?? hoy;
  const dias = Math.min(31, Math.max(1, Number.parseInt(params.dias ?? "7", 10) || 7));
  const hasta = sumarDias(desde, dias - 1);

  const supabase = await crearClienteServidor();

  const [{ data: limpiezas }, { data: personas }, { data: feriados }] =
    await Promise.all([
      supabase
        .from("limpiezas")
        .select(
          "id, fecha, tipo, urgente, estado, prox_checkin, hora_checkout, fecha_manual, depto_id, asignado_a, monto_pactado, moneda, pago_doble, depto:departamentos(codigo, barrio, ambientes), responsable:personas(nombre), reserva:reservas(id, noches, fecha_checkout, datos_completos)",
        )
        .gte("fecha", desde)
        .lte("fecha", hasta)
        .neq("estado", "cancelada")
        .order("fecha")
        .order("urgente", { ascending: false }),
      supabase
        .from("personas")
        .select("id, nombre")
        .eq("hace_limpieza", true)
        .eq("activo", true)
        .order("nombre"),
      supabase.from("feriados").select("fecha").gte("fecha", desde).lte("fecha", hasta),
    ]);

  // Horarios coordinados: la salida de cada reserva y la llegada del próximo
  // huésped del mismo departamento.
  const idsReservas = (limpiezas ?? [])
    .map((l) => l.reserva?.id)
    .filter((id): id is string => !!id);
  const deptos = [...new Set((limpiezas ?? []).map((l) => l.depto_id))];

  const [{ data: eventosSalida }, { data: llegadas }, { data: estadias }] =
    await Promise.all([
      idsReservas.length > 0
        ? supabase
            .from("eventos_estadia")
            .select("reserva_id, fecha_coordinada, hora_coordinada")
            .eq("tipo", "checkout")
            .in("reserva_id", idsReservas)
        : Promise.resolve({ data: [] }),
      deptos.length > 0
        ? supabase
            .from("reservas")
            .select("depto_id, fecha_checkin, eventos:eventos_estadia(tipo, hora_coordinada)")
            .in("depto_id", deptos)
            .eq("cancelada", false)
            .eq("descartada", false)
            .gte("fecha_checkin", desde)
            .lte("fecha_checkin", sumarDias(hasta, 1))
        : Promise.resolve({ data: [] }),
      // Las estadías que ATRAVIESAN el período: sirven para detectar una
      // limpieza que cae con el huésped adentro sin estar marcada como tal.
      deptos.length > 0
        ? supabase
            .from("reservas")
            .select(
              "depto_id, codigo_reserva, fecha_checkin, fecha_checkout, cancelada, descartada",
            )
            .in("depto_id", deptos)
            .eq("cancelada", false)
            .eq("descartada", false)
            .lte("fecha_checkin", hasta)
            .gte("fecha_checkout", desde)
        : Promise.resolve({ data: [] }),
    ]);

  const salidaPorReserva = new Map(
    (eventosSalida ?? []).map((e) => [
      e.reserva_id,
      { fecha: e.fecha_coordinada, hora: e.hora_coordinada },
    ]),
  );
  const horaLlegadaPorDeptoFecha = new Map(
    (llegadas ?? []).map((r) => [
      `${r.depto_id}|${r.fecha_checkin}`,
      r.eventos?.find((e) => e.tipo === "checkin")?.hora_coordinada ?? null,
    ]),
  );
  const fechasFeriado = new Set((feriados ?? []).map((f) => f.fecha));

  const porDia = new Map<string, NonNullable<typeof limpiezas>>();
  for (const l of limpiezas ?? []) {
    if (!porDia.has(l.fecha)) porDia.set(l.fecha, []);
    porDia.get(l.fecha)!.push(l);
  }

  // Siempre las siete filas, aunque un día no tenga limpiezas.
  const fechas = Array.from({ length: dias }, (_, i) => sumarDias(desde, i));

  // Lo que hay que MIRAR, no lo que hay que hacer: una limpieza con el
  // huésped adentro sin estar marcada como tal, o dos el mismo día en el
  // mismo departamento. El sistema no las arregla solo porque las dos cosas
  // pueden ser legítimas o un error grave, y no se distingue sin mirar.
  const alertas = revisarLimpiezas(
    (limpiezas ?? []).map((l) => ({
      id: l.id,
      depto_id: l.depto_id,
      fecha: l.fecha,
      tipo: l.tipo,
      estado: l.estado,
    })),
    (estadias ?? []) as EstadiaRevisar[],
  );

  const total = (limpiezas ?? []).length;
  const totalSinAsignar = (limpiezas ?? []).filter((l) => !l.asignado_a).length;
  const carga = cargaPorPersona(limpiezas ?? []);
  const opciones: PersonaOpcion[] = personas ?? [];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 bg-fondo px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
            Limpiezas
          </h1>
          {/* El resumen antes del detalle: lo que falta se ve sin recorrer
              la lista. */}
          <p className="text-sm tabular-nums text-tinta-suave">
            {formatearFechaAR(desde)} al {formatearFechaAR(hasta)} · {total}{" "}
            {total === 1 ? "limpieza" : "limpiezas"}
            {totalSinAsignar > 0 && (
              <span className="font-medium text-accent-soft-text">
                {" "}
                · {totalSinAsignar} sin asignar
              </span>
            )}
          </p>
        </div>
        <Link href="/limpiezas/nueva" className={clsBoton("primario")}>
          + Nueva
        </Link>
      </div>

      <NavegadorSemana desde={desde} />

      {alertas.size > 0 && (
        <div className="rounded border border-borde border-l-[3px] border-l-aviso bg-aviso-soft px-4 py-3">
          <p className="text-sm font-medium text-aviso-text">
            {alertas.size} {alertas.size === 1 ? "limpieza" : "limpiezas"} para
            revisar en este período
          </p>
          <p className="mt-0.5 text-xs text-aviso-text/80">
            Están marcadas abajo con el motivo. No se tocaron solas: puede ser
            correcto o puede estar mal, y eso lo decide una persona.
          </p>
        </div>
      )}

      {/* Cuánto lleva cada persona: se mira antes de darle una más a alguien */}
      {carga.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded border border-borde bg-superficie p-3 shadow-sm">
          {carga.map((c) => (
            <span
              key={c.personaId}
              className="rounded-sm bg-superficie-alt px-3 py-1.5 text-sm tabular-nums"
            >
              <span className="font-medium text-tinta">{c.nombre}</span>
              <span className="ml-2 text-tinta-suave">
                {c.cantidad} {c.cantidad === 1 ? "limpieza" : "limpiezas"}
              </span>
              {c.monto > 0 && (
                <span className="ml-2 text-exito-text">
                  {formatearMonto(c.monto, c.moneda)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {fechas.map((fecha) => {
          const delDia = porDia.get(fecha) ?? [];
          const asignadas = delDia.filter((l) => l.asignado_a).length;
          const faltanAsignar = delDia.length - asignadas;
          const proporcion = delDia.length > 0 ? (asignadas / delDia.length) * 100 : 0;
          const pagoDoble = diaDeLaSemana(fecha) === 0 || fechasFeriado.has(fecha);
          const semaforoDia = semaforoDeLimpieza({
            fecha,
            hoy,
            tieneResponsable: faltanAsignar === 0,
          });

          return (
            /* Cada día se despliega para ver y repartir sus limpiezas. El de
               hoy arranca abierto porque es el que se mira primero. */
            <details
              key={fecha}
              open={fecha === hoy && delDia.length > 0}
              className={`group rounded border border-borde border-l-[3px] bg-superficie shadow-sm ${
                delDia.length === 0
                  ? "border-l-borde opacity-60"
                  : BORDE_SEMAFORO[semaforoDia]
              }`}
            >
              <summary className="flex cursor-pointer flex-col gap-2 px-4 py-3 [&::-webkit-details-marker]:hidden">
                <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-semibold capitalize text-tinta">
                    {DIAS_SEMANA[diaDeLaSemana(fecha)]}
                  </span>
                  <span className="text-sm tabular-nums text-tinta-suave">
                    {formatearFechaAR(fecha)}
                  </span>
                  {fecha === hoy && (
                    <span className="rounded-sm bg-warm-100 px-2 py-0.5 text-xs font-medium text-warm-600">
                      hoy
                    </span>
                  )}
                  {pagoDoble && delDia.length > 0 && (
                    <span className="rounded-sm bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-soft-text">
                      pago doble
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-3 text-sm">
                    {delDia.length === 0 ? (
                      <span className="text-tinta-tenue">sin limpiezas</span>
                    ) : (
                      <>
                        <span className="tabular-nums text-tinta-suave">
                          {delDia.length} {delDia.length === 1 ? "limpieza" : "limpiezas"}
                        </span>
                        {/* La alarma del día: lo que falta repartir, con punto
                            para que no dependa solo del color. */}
                        {faltanAsignar > 0 && (
                          <span className="inline-flex items-center gap-1.5 rounded-sm bg-alerta-soft px-2.5 py-0.5 text-xs font-semibold tabular-nums text-alerta-text">
                            <span aria-hidden className="size-1.5 rounded-full bg-alerta-punto" />
                            {faltanAsignar} sin asignar
                          </span>
                        )}
                      </>
                    )}
                    {delDia.length > 0 && (
                      <span className="text-tinta-tenue transition-transform group-open:rotate-180">
                        ▾
                      </span>
                    )}
                  </span>
                </span>

                {delDia.length > 0 && (
                  /* Barra de proporción: cuánto del día ya está repartido */
                  <span className="block h-1.5 overflow-hidden rounded-full bg-accent-soft">
                    <span
                      className="block h-full rounded-full bg-primary transition-all"
                      style={{ width: `${proporcion}%` }}
                    />
                  </span>
                )}
              </summary>

              {delDia.length > 0 && (
                <ul className="flex flex-col gap-2 border-t border-borde p-3">
                  {delDia.map((l) => {
                    const proximo = l.prox_checkin?.slice(0, 10) ?? null;
                    const mismoDia = proximo === l.fecha;
                    const salida = l.reserva ? salidaPorReserva.get(l.reserva.id) : null;
                    const fechaSalida = salida?.fecha ?? l.reserva?.fecha_checkout ?? null;
                    const horaSalida = formatearHora(salida?.hora ?? l.hora_checkout);
                    const horaLlegada = proximo
                      ? formatearHora(horaLlegadaPorDeptoFecha.get(`${l.depto_id}|${proximo}`))
                      : null;
                    const salidaOtroDia = fechaSalida && fechaSalida !== l.fecha;
                    const semaforo = semaforoDeLimpieza({
                      fecha: l.fecha,
                      hoy,
                      tieneResponsable: !!l.asignado_a,
                    });
                    const revisar = alertas.get(l.id) ?? [];

                    return (
                      <li
                        key={l.id}
                        className={`flex flex-col gap-2 rounded border border-borde border-l-[3px] px-3 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-4 ${
                          BORDE_SEMAFORO[semaforo]
                        } ${
                          // Una sola alarma por fila: el fondo lo pone el
                          // semáforo, o la revisión, nunca los dos.
                          revisar.length > 0
                            ? "bg-aviso-soft"
                            : FONDO_SEMAFORO[semaforo] || "bg-superficie"
                        }`}
                      >
                        <Link href={`/limpiezas/${l.id}`} className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                            <span className="font-mono text-sm font-semibold text-tinta">
                              {l.depto?.codigo}
                            </span>
                            {/* Entra otro huésped el mismo día: es lo que pasa
                                ahora, y por eso va en el acento. */}
                            {mismoDia && (
                              <Badge tono={TONO_LIMPIEZA.en_curso}>Check in/out</Badge>
                            )}
                            {/* Salió del calendario: la reserva todavía no
                                se confirmó con el archivo de Airbnb. El borde
                                punteado la distingue sin depender del color. */}
                            {l.reserva && !l.reserva.datos_completos && (
                              <Badge tono={TONO_RESERVA.tentativa}>Tentativa</Badge>
                            )}
                            {/* Para que se sepa por qué esta no cae el día del
                                check-out, y que la importación no la va a
                                mover. */}
                            {l.fecha_manual && (
                              <Badge
                                tono={TONO_LIMPIEZA.pendiente}
                                title="La fecha la puso una persona. La importación no la mueve."
                              >
                                Fecha a mano
                              </Badge>
                            )}
                            {l.monto_pactado !== null && (
                              <span className="ml-auto text-sm tabular-nums text-exito-text">
                                {formatearMonto(l.monto_pactado, l.moneda)}
                                {l.pago_doble && (
                                  <span className="ml-1 text-xs">×2</span>
                                )}
                              </span>
                            )}
                          </span>
                          <span className="block text-sm text-tinta-suave">
                            {TIPOS_LIMPIEZA[l.tipo] ?? l.tipo}
                            {l.depto?.ambientes &&
                              ` · ${ETIQUETA_AMBIENTES[l.depto.ambientes]}`}
                            {l.depto?.barrio && ` · ${l.depto.barrio}`}
                            {l.reserva?.noches ? ` · ${l.reserva.noches} noches` : ""}
                          </span>
                          <span className="block text-xs tabular-nums text-tinta-tenue">
                            {fechaSalida
                              ? `sale ${salidaOtroDia ? formatearFechaAR(fechaSalida) + " " : ""}${horaSalida ?? "sin hora"}`
                              : null}
                            {fechaSalida && proximo ? " → " : null}
                            {proximo
                              ? `entra ${mismoDia ? "" : formatearFechaAR(proximo) + " "}${horaLlegada ?? (mismoDia ? "sin hora" : "")}`
                              : null}
                          </span>
                          {revisar.map((a) => (
                            <span
                              key={a.motivo}
                              className="mt-1 block text-xs font-medium text-aviso-text"
                            >
                              ⚠ {a.detalle}
                            </span>
                          ))}
                        </Link>

                        <SelectorResponsable
                          personas={opciones}
                          asignadoA={l.asignado_a}
                          accion={asignarRapido.bind(null, l.id)}
                        />
                      </li>
                    );
                  })}
                </ul>
              )}
            </details>
          );
        })}
      </div>

      {opciones.length === 0 && (
        <p className="rounded-sm bg-aviso-soft px-3 py-2 text-xs text-aviso-text">
          No hay personas que hagan limpieza cargadas: agregalas en Personas
          para poder asignar.
        </p>
      )}
    </main>
  );
}
