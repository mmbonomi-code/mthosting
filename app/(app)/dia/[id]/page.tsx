import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import { puedeGestionarReclamos } from "@/lib/reclamos/permisos";
import { puedeEditarReservas } from "@/lib/reservas/permisos";
import {
  requiereAtencion,
  semaforoDeReclamo,
  textoDePlazo,
  type EstadoReclamo,
} from "@/lib/reclamos/plazos";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import { formatearHora } from "@/lib/limpiezas/etiquetas";
import { METODOS_ACCESO, METODOS_FISICOS } from "@/lib/eventos/etiquetas";
import {
  departamentoListo,
  ventanaDisponible,
  ventanaInsuficiente,
  type EstadoLimpieza,
} from "@/lib/eventos/reglas";
import { faltantesDeEvento } from "@/lib/eventos/faltantes";
import BotonCopiar from "@/app/componentes/BotonCopiar";
import Wifi from "@/app/componentes/Wifi";
import PanelCoordinacion, { type OpcionAcceso } from "./PanelCoordinacion";
import {
  alternarLateCheckout,
  coordinarEvento,
  marcarAccesoDejado,
  marcarItem,
} from "../acciones";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="text-base text-slate-200">{children ?? "—"}</dd>
    </div>
  );
}

/** Teléfono sin nada que no sea dígito, para llamar y para WhatsApp. */
function soloDigitos(telefono: string | null): string | null {
  if (!telefono) return null;
  const limpio = telefono.replace(/\D/g, "");
  return limpio === "" ? null : limpio;
}

export default async function FichaEvento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: evento } = await supabase
    .from("eventos_estadia")
    .select(
      `id, tipo, fecha_coordinada, hora_coordinada, estado, late_checkout, acceso_dejado, observaciones,
       punto_acceso_id, responsable_id, punto_devolucion_id, responsable_devolucion_id,
       reserva:reservas(
         id, codigo_reserva, huesped_nombre, huesped_contacto, noches, adultos, ninos, bebes,
         fecha_checkin, fecha_checkout, cancelada, datos_completos, origen, raw,
         registro_hecho, aviso_seguridad_hecho, sobre_ok,
         depto:departamentos(
           id, codigo, nombre_interno, direccion, barrio, ambientes, capacidad, wifi_ssid, wifi_pass,
           encargado_nombre, encargado_telefono, indicaciones_acceso, requiere_registro,
           requiere_aviso_seguridad, self_checkout, url_mapa
         )
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!evento?.reserva) notFound();

  const r = evento.reserva;
  const depto = r.depto;
  const esLlegada = evento.tipo === "checkin";
  const fechaReserva = (esLlegada ? r.fecha_checkin : r.fecha_checkout) ?? "";

  // Quién abre se elige del catálogo de puntos de acceso: las personas están
  // ahí como "Presencial — Maguie". La lista de personas ya no se ofrece.
  // Lo único que se sigue leyendo es el responsable de las coordinaciones
  // viejas, para no perder lo que ya estaba cargado.
  const accesoActual = esLlegada
    ? evento.punto_acceso_id
      ? `punto:${evento.punto_acceso_id}`
      : evento.responsable_id
        ? `persona:${evento.responsable_id}`
        : ""
    : evento.punto_devolucion_id
      ? `punto:${evento.punto_devolucion_id}`
      : evento.responsable_devolucion_id
        ? `persona:${evento.responsable_devolucion_id}`
        : "";

  const responsableViejo = accesoActual.startsWith("persona:")
    ? accesoActual.slice("persona:".length)
    : null;

  const [
    { data: puntos },
    { data: personas },
    { data: parametros },
    { data: eventoOpuesto },
  ] = await Promise.all([
    supabase
      .from("puntos_acceso")
      .select("id, metodo, ubicacion, identificador, instrucciones, sirve_checkin, sirve_checkout")
      .eq("activo", true)
      // En el orden que fijó el usuario: primero los que más se usan.
      .order("orden")
      .order("ubicacion"),
    responsableViejo
      ? supabase.from("personas").select("id, nombre").eq("id", responsableViejo)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    supabase.from("parametros_operativos").select("clave, valor"),
    supabase
      .from("eventos_estadia")
      .select("id, tipo, fecha_coordinada, hora_coordinada")
      .eq("reserva_id", r.id)
      .neq("id", id)
      .maybeSingle(),
  ]);

  const config = Object.fromEntries((parametros ?? []).map((p) => [p.clave, p.valor]));

  // --- Contexto del departamento: salida anterior, próxima llegada, limpieza ---
  let salidaAnterior: { fecha: string; hora: string | null } | null = null;
  let proximaLlegada: { fecha: string; hora: string | null } | null = null;
  let listo = false;
  let hayEntradaEseDia = false;

  if (depto) {
    const [{ data: previas }, { data: siguientes }, { count: entradas }] =
      await Promise.all([
        supabase
          .from("reservas")
          .select("id, fecha_checkout, eventos:eventos_estadia(tipo, fecha_coordinada, hora_coordinada)")
          .eq("depto_id", depto.id)
          .eq("cancelada", false)
          .eq("descartada", false)
          .lte("fecha_checkout", fechaReserva)
          .neq("id", r.id)
          .order("fecha_checkout", { ascending: false })
          .limit(1),
        supabase
          .from("reservas")
          .select("id, fecha_checkin, eventos:eventos_estadia(tipo, fecha_coordinada, hora_coordinada)")
          .eq("depto_id", depto.id)
          .eq("cancelada", false)
          .eq("descartada", false)
          .gte("fecha_checkin", fechaReserva)
          .neq("id", r.id)
          .order("fecha_checkin")
          .limit(1),
        // ¿Entra alguien el mismo día de esta salida? Define si el late
        // check-out puede mover la limpieza solo o genera conflicto.
        supabase
          .from("reservas")
          .select("id", { count: "exact", head: true })
          .eq("depto_id", depto.id)
          .eq("cancelada", false)
          .eq("descartada", false)
          .eq("fecha_checkin", fechaReserva)
          .neq("id", r.id),
      ]);

    hayEntradaEseDia = (entradas ?? 0) > 0;

    const previa = previas?.[0];
    if (previa?.fecha_checkout) {
      const ev = previa.eventos?.find((e) => e.tipo === "checkout");
      salidaAnterior = {
        fecha: ev?.fecha_coordinada ?? previa.fecha_checkout,
        hora: ev?.hora_coordinada ?? null,
      };
    }

    const siguiente = siguientes?.[0];
    if (siguiente?.fecha_checkin) {
      const ev = siguiente.eventos?.find((e) => e.tipo === "checkin");
      proximaLlegada = {
        fecha: ev?.fecha_coordinada ?? siguiente.fecha_checkin,
        hora: ev?.hora_coordinada ?? null,
      };
    }

    if (esLlegada) {
      const { data: limpiezas } = await supabase
        .from("limpiezas")
        .select("fecha, estado")
        .eq("depto_id", depto.id)
        .lte("fecha", evento.fecha_coordinada ?? fechaReserva);
      listo = departamentoListo({
        limpiezas: (limpiezas ?? []) as { fecha: string; estado: EstadoLimpieza }[],
        ultimoCheckout: salidaAnterior?.fecha ?? null,
        fechaLlegada: evento.fecha_coordinada ?? fechaReserva,
      });
    }
  }

  const puntoElegido = (puntos ?? []).find((p) => `punto:${p.id}` === accesoActual);

  // El que ya está elegido se incluye siempre, aunque hoy no figure como
  // apto para este tipo de evento: si no, el desplegable lo perdería.
  const opciones: OpcionAcceso[] = [
    ...(puntos ?? [])
      .filter(
        (p) =>
          ((esLlegada ? p.sirve_checkin : p.sirve_checkout) &&
            // Si el departamento no permite self, la opción ni aparece.
            !(p.metodo === "self" && depto?.self_checkout === "no")) ||
          `punto:${p.id}` === accesoActual,
      )
      .map((p) => ({
        valor: `punto:${p.id}`,
        etiqueta: `${METODOS_ACCESO[p.metodo]} — ${[p.ubicacion, p.identificador].filter(Boolean).join(" ")}`,
        grupo: "Sin persona" as const,
        metodo: p.metodo,
        instrucciones: p.instrucciones,
      })),
    // Solo si esta coordinación ya tenía una persona cargada de antes: se
    // conserva para no borrarla sola, pero no se ofrecen otras.
    ...(personas ?? []).map((p) => ({
      valor: `persona:${p.id}`,
      etiqueta: `${p.nombre} (cargado antes)`,
      grupo: "Personas" as const,
    })),
  ];

  const huespedes = (r.adultos ?? 0) + (r.ninos ?? 0);
  // El único caso que exige confirmación explícita es el riesgoso: una sola
  // persona donde el self necesita dos. El resto es solo información.
  const selfRiesgoso = depto?.self_checkout === "solo_multiples" && huespedes <= 1;
  const avisoSelf =
    depto?.self_checkout === "no"
      ? "Este departamento no permite self check-out."
      : selfRiesgoso
        ? "Viene una sola persona: si deja las llaves adentro puede quedar trabada afuera. Con 2 o más, una sostiene el acceso mientras la otra devuelve."
        : depto?.self_checkout === "solo_multiples"
          ? "Bajan, abren la puerta, uno sube a dejar las llaves y baja."
          : "Dejan las llaves adentro y salen.";

  const horaSalida = esLlegada
    ? (salidaAnterior?.hora ?? null)
    : (evento.hora_coordinada ?? null);
  const horaEntrada = esLlegada
    ? (evento.hora_coordinada ?? null)
    : proximaLlegada?.fecha === (evento.fecha_coordinada ?? fechaReserva)
      ? (proximaLlegada?.hora ?? null)
      : null;
  const ventana = ventanaDisponible(horaSalida, horaEntrada);
  const imposible = ventanaInsuficiente({
    horaSalida,
    horaEntrada,
    horaLimiteCheckout: config.hora_limite_checkout ?? "11:00",
    horaMinimaCheckin: config.hora_minima_checkin ?? "12:00",
  });

  const telefono = soloDigitos(r.huesped_contacto);

  // Reclamo de daños de esta reserva, si lo hay y si quien mira puede verlo.
  const [verReclamos, puedeEditar] = await Promise.all([
    puedeGestionarReclamos(supabase),
    puedeEditarReservas(supabase),
  ]);
  const { data: reclamo } = verReclamos
    ? await supabase
        .from("reclamos")
        .select("id, estado")
        .eq("reserva_id", r.id)
        .maybeSingle()
    : { data: null };
  const plazoReclamo = reclamo
    ? semaforoDeReclamo(r.fecha_checkout, reclamo.estado as EstadoReclamo, hoyAR())
    : null;

  const faltantes = faltantesDeEvento({
    tipo: esLlegada ? "checkin" : "checkout",
    horaCoordinada: evento.hora_coordinada,
    acceso: puntoElegido
      ? { clase: "punto" as const, metodo: puntoElegido.metodo }
      : accesoActual.startsWith("persona:")
        ? { clase: "persona" as const }
        : null,
    accesoDejado: evento.acceso_dejado,
    requiereRegistro: depto?.requiere_registro ?? false,
    registroHecho: r.registro_hecho,
    requiereAviso: depto?.requiere_aviso_seguridad ?? false,
    avisoHecho: r.aviso_seguridad_hecho,
  });

  // Las casillas que corresponden a este evento, todas dentro del panel.
  const tildes = esLlegada
    ? [
        ...(puntoElegido && METODOS_FISICOS.has(puntoElegido.metodo)
          ? [
              {
                clave: "acceso_dejado",
                etiqueta: `Dejé ${METODOS_ACCESO[puntoElegido.metodo].toLowerCase()} ${[puntoElegido.ubicacion, puntoElegido.identificador].filter(Boolean).join(" ")}`,
                detalle: "Confirmación de que el equipo ya lo dejó en el punto de acceso",
                activo: evento.acceso_dejado,
                accion: marcarAccesoDejado.bind(null, id),
              },
            ]
          : []),
        ...(depto?.requiere_registro
          ? [
              {
                clave: "registro",
                etiqueta: "Registro de huéspedes",
                activo: r.registro_hecho,
                accion: marcarItem.bind(null, r.id, "registro_hecho" as const),
              },
            ]
          : []),
        ...(depto?.requiere_aviso_seguridad
          ? [
              {
                clave: "aviso",
                etiqueta: "Aviso a seguridad",
                activo: r.aviso_seguridad_hecho,
                accion: marcarItem.bind(null, r.id, "aviso_seguridad_hecho" as const),
              },
            ]
          : []),
      ]
    : [
        {
          clave: "late",
          etiqueta: "Late check-out",
          detalle: hayEntradaEseDia
            ? "Ese día entra otro huésped: la limpieza no se mueve sola."
            : "Ese día no se puede limpiar: la limpieza se mueve sola al día siguiente.",
          activo: evento.late_checkout,
          accion: alternarLateCheckout.bind(null, id),
          avisoAlActivar: hayEntradaEseDia
            ? "Atención: hay un huésped entrando ese mismo día. La limpieza NO se movió — hay que resolverlo hablando con alguno de los dos."
            : null,
        },
      ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link
        href={`/dia?fecha=${evento.fecha_coordinada ?? fechaReserva}`}
        className="text-sm text-slate-400 hover:text-white"
      >
        ← Volver al día
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              esLlegada ? "bg-sky-950 text-sky-300" : "bg-orange-950 text-orange-300"
            }`}
          >
            {esLlegada ? "Llegada" : "Salida"}
          </span>
          {r.cancelada && (
            <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-xs font-medium text-red-300">
              Cancelada
            </span>
          )}
          {!r.datos_completos && (
            <span className="rounded-full bg-violet-950 px-2.5 py-0.5 text-xs font-medium text-violet-300">
              Tentativa
            </span>
          )}
          {faltantes.length === 0 && (
            <span className="rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
              Coordinado
            </span>
          )}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {r.huesped_nombre ?? "Sin nombre"}
          <span className="ml-3 font-mono text-lg font-normal text-emerald-300">
            {depto?.codigo}
          </span>
        </h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-400">
          <span className="font-mono">{r.codigo_reserva}</span>
          {r.huesped_contacto && (
            <span className="flex items-center gap-2">
              <span className="font-mono text-slate-300">{r.huesped_contacto}</span>
              <BotonCopiar texto={r.huesped_contacto} />
            </span>
          )}
        </p>
      </div>

      {/* Contacto: lo primero que se necesita en la calle */}
      {telefono ? (
        <a
          href={`https://wa.me/${telefono}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          WhatsApp
        </a>
      ) : (
        <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
          Sin teléfono cargado
          {r.cancelada
            ? " (Airbnb lo borra al cancelar)."
            : !r.datos_completos
              ? `. Vino del calendario: solo se conocen los últimos 4 dígitos${
                  (r.raw as { telefono_ultimos_4?: string } | null)?.telefono_ultimos_4
                    ? ` (···${(r.raw as { telefono_ultimos_4?: string }).telefono_ultimos_4})`
                    : ""
                }. El teléfono completo llega con la próxima importación.`
              : "."}
        </p>
      )}

      {imposible && (
        <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          <strong>Ventana insuficiente:</strong> con esos horarios no hay tiempo
          material para limpiar. Hay que negociar con uno de los dos huéspedes.
        </p>
      )}

      {/* Coordinación: arriba, con todo adentro y guardado automático */}
      <PanelCoordinacion
        guardar={coordinarEvento.bind(null, id)}
        opciones={opciones}
        valores={{
          acceso: accesoActual,
          fecha_coordinada: evento.fecha_coordinada ?? "",
          hora_coordinada: evento.hora_coordinada?.slice(0, 5) ?? "",
          observaciones: evento.observaciones ?? "",
          fechaReserva,
        }}
        tildes={tildes}
        faltantes={faltantes}
        avisoSelf={avisoSelf}
        requiereConfirmacionSelf={selfRiesgoso}
        horaLimiteCheckout={config.hora_limite_checkout ?? "11:00"}
        horaMinimaCheckin={config.hora_minima_checkin ?? "12:00"}
        esCheckout={!esLlegada}
        horaSalidaMismoDia={
          // Solo importa si la salida anterior es de ESTE mismo día.
          esLlegada && salidaAnterior?.fecha === (evento.fecha_coordinada ?? fechaReserva)
            ? salidaAnterior.hora
            : null
        }
      />

      {esLlegada && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            listo ? "bg-emerald-950/60 text-emerald-200" : "bg-slate-800/60 text-slate-300"
          }`}
        >
          {listo
            ? "✓ Departamento listo: ya se limpió después de la última salida."
            : "El departamento todavía no figura limpio para esta llegada."}
        </p>
      )}

      {/* Estadía */}
      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 p-4 sm:grid-cols-4">
        <Dato etiqueta={esLlegada ? "Entra (reserva)" : "Sale (reserva)"}>
          {fechaReserva ? formatearFechaAR(fechaReserva) : "—"}
        </Dato>
        {/* En la salida importa desde cuándo está el huésped: da una idea de
            cómo va a quedar el departamento. */}
        {!esLlegada && (
          <Dato etiqueta="Entró">
            {r.fecha_checkin ? formatearFechaAR(r.fecha_checkin) : "—"}
          </Dato>
        )}
        <Dato etiqueta="Noches">{r.noches}</Dato>
        <Dato etiqueta="Personas">
          {[
            r.adultos ? `${r.adultos} ad.` : null,
            r.ninos ? `${r.ninos} niños` : null,
            r.bebes ? `${r.bebes} bebés` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </Dato>
        <Dato etiqueta="Estado">{evento.late_checkout ? "Late check-out" : "—"}</Dato>
        <div className="col-span-2 sm:col-span-4">
          <Dato etiqueta={esLlegada ? "Salida anterior" : "Próxima llegada"}>
            {esLlegada
              ? salidaAnterior
                ? `${formatearFechaAR(salidaAnterior.fecha)}${
                    formatearHora(salidaAnterior.hora)
                      ? ` a las ${formatearHora(salidaAnterior.hora)}`
                      : ""
                  }${ventana ? ` · ventana ${ventana}` : ""}`
                : "sin salida previa"
              : proximaLlegada
                ? `${formatearFechaAR(proximaLlegada.fecha)}${
                    formatearHora(proximaLlegada.hora)
                      ? ` a las ${formatearHora(proximaLlegada.hora)}`
                      : ""
                  }${ventana ? ` · ventana ${ventana}` : ""}`
                : "sin reserva próxima"}
          </Dato>
        </div>
      </dl>

      {/* Departamento */}
      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">
          {depto?.codigo}{" "}
          <span className="font-normal text-slate-400">{depto?.nombre_interno}</span>
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div className="col-span-2 sm:col-span-3">
            <Dato etiqueta="Dirección">
              {depto?.url_mapa ? (
                <a
                  href={depto.url_mapa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline decoration-slate-600 underline-offset-4"
                >
                  {depto.direccion} ↗
                </a>
              ) : (
                depto?.direccion
              )}
            </Dato>
          </div>
          <Dato etiqueta="Barrio">{depto?.barrio}</Dato>
          <Dato etiqueta="Ambientes">
            {depto?.ambientes ? ETIQUETA_AMBIENTES[depto.ambientes] : "—"}
          </Dato>
          <Dato etiqueta="Capacidad">
            {depto?.capacidad ? `${depto.capacidad} pers.` : "—"}
          </Dato>
          <div className="col-span-2 sm:col-span-3">
            <Dato etiqueta="Wifi">
              <Wifi ssid={depto?.wifi_ssid ?? null} pass={depto?.wifi_pass ?? null} />
            </Dato>
          </div>
        </dl>

        {(depto?.indicaciones_acceso || depto?.encargado_nombre) && (
          <div className="flex flex-col gap-2 border-t border-slate-800 pt-3">
            {depto?.encargado_nombre && (
              <p className="text-sm text-slate-300">
                Encargado: {depto.encargado_nombre}
                {depto.encargado_telefono && (
                  <a
                    href={`tel:${depto.encargado_telefono}`}
                    className="ml-2 underline decoration-slate-600 underline-offset-4"
                  >
                    {depto.encargado_telefono}
                  </a>
                )}
              </p>
            )}
            {depto?.indicaciones_acceso && (
              <p className="whitespace-pre-wrap text-sm text-slate-400">
                {depto.indicaciones_acceso}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Editar los datos de la reserva: sobre todo las que trajo el
          calendario, que llegan sin nombre ni teléfono. */}
      {puedeEditar && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-4">
          <div>
            <h2 className="font-medium text-white">Datos de la reserva</h2>
            <p className="text-sm text-slate-400">
              {r.datos_completos
                ? "Fechas, huésped y contacto. Lo que edites lo puede pisar la próxima importación."
                : "Vino del calendario: cargale el nombre y el teléfono."}
            </p>
          </div>
          <Link
            href={`/reservas/${r.id}/editar`}
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
          >
            {r.datos_completos ? "Editar reserva" : "Completar datos"}
          </Link>
        </section>
      )}

      {/* Reclamo de daños: se carga desde la reserva, que es donde se está
          mirando cuando la limpieza avisa que algo se rompió. */}
      {verReclamos && (
        <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 p-4">
          <div>
            <h2 className="font-medium text-white">Reclamo a Airbnb</h2>
            <p className="text-sm text-slate-400">
              {reclamo
                ? "Esta reserva ya tiene un reclamo cargado."
                : "Si el huésped dañó algo, se reclama desde acá."}
            </p>
          </div>
          {reclamo ? (
            <Link
              href={`/reclamos/${reclamo.id}`}
              className="flex items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
            >
              Ver reclamo
              {plazoReclamo && requiereAtencion(plazoReclamo.semaforo) && (
                <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs text-red-300">
                  {textoDePlazo(plazoReclamo.dias)}
                </span>
              )}
            </Link>
          ) : (
            <Link
              href={`/reclamos/nuevo?reserva=${r.id}`}
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
            >
              Cargar reclamo
            </Link>
          )}
        </section>
      )}

      {eventoOpuesto && (
        <Link
          href={`/dia/${eventoOpuesto.id}`}
          className="text-sm text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-white"
        >
          Ver {eventoOpuesto.tipo === "checkin" ? "la llegada" : "la salida"} de esta
          misma estadía →
        </Link>
      )}
    </main>
  );
}
