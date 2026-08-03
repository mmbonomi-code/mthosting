import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR } from "@/lib/fechas";
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
import Wifi from "@/app/componentes/Wifi";
import FormularioCoordinar, { type OpcionAcceso } from "./FormularioCoordinar";
import Interruptor from "./Interruptores";
import {
  alternarLateCheckout,
  coordinarEvento,
  marcarAccesoDejado,
  marcarHecho,
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

/** Teléfono sin nada que no sea dígito, para los enlaces de llamada y WhatsApp. */
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
         fecha_checkin, fecha_checkout, cancelada, registro_hecho, aviso_seguridad_hecho, sobre_ok,
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
      .order("ubicacion"),
    supabase
      .from("personas")
      .select("id, nombre")
      .eq("hace_checkin", true)
      .eq("activo", true)
      .order("nombre"),
    supabase.from("parametros_operativos").select("clave, valor"),
    // El otro extremo de la misma estadía, para ver la estadía completa.
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

  if (depto) {
    const [{ data: previas }, { data: siguientes }] = await Promise.all([
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
    ]);

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

  const puntoElegido = (puntos ?? []).find((p) => `punto:${p.id}` === accesoActual);

  // --- Selector unificado: puntos que sirven para este evento, más personas ---
  // El que ya está elegido se incluye siempre, aunque hoy no figure como
  // apto para este tipo de evento: si no, el desplegable lo perdería.
  const opciones: OpcionAcceso[] = [
    ...(puntos ?? [])
      .filter(
        (p) =>
          (esLlegada ? p.sirve_checkin : p.sirve_checkout) ||
          `punto:${p.id}` === accesoActual,
      )
      .map((p) => ({
        valor: `punto:${p.id}`,
        etiqueta: `${METODOS_ACCESO[p.metodo]} — ${[p.ubicacion, p.identificador].filter(Boolean).join(" ")}`,
        grupo: "Sin persona" as const,
        metodo: p.metodo,
        instrucciones: p.instrucciones,
      })),
    ...(personas ?? []).map((p) => ({
      valor: `persona:${p.id}`,
      etiqueta: p.nombre,
      grupo: "Personas" as const,
    })),
  ];

  const huespedes = (r.adultos ?? 0) + (r.ninos ?? 0);
  const avisoSelf =
    depto?.self_checkout === "no"
      ? "Este departamento no permite self check-out."
      : depto?.self_checkout === "solo_multiples" && huespedes <= 1
        ? "Viene una sola persona: si deja las llaves adentro puede quedar trabada afuera. Con 2 o más, una sostiene el acceso mientras la otra devuelve."
        : depto?.self_checkout === "solo_multiples"
          ? "Bajan, abren la puerta, uno sube a dejar las llaves y baja."
          : "Dejan las llaves adentro y salen.";

  // Ventana entre la salida de hoy y la llegada siguiente, para no acordar
  // un horario imposible mientras se coordina.
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

  // Qué falta para dar el evento por coordinado.
  const faltantes = faltantesDeEvento({
    tipo: esLlegada ? "checkin" : "checkout",
    horaCoordinada: evento.hora_coordinada,
    acceso: puntoElegido
      ? {
          clase: "punto",
          metodo: puntoElegido.metodo,
          ubicacion: puntoElegido.ubicacion,
          identificador: puntoElegido.identificador,
        }
      : accesoActual.startsWith("persona:")
        ? { clase: "persona" }
        : null,
    accesoDejado: evento.acceso_dejado,
    requiereRegistro: depto?.requiere_registro ?? false,
    registroHecho: r.registro_hecho,
    requiereAviso: depto?.requiere_aviso_seguridad ?? false,
    avisoHecho: r.aviso_seguridad_hecho,
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link
        href={`/dia?fecha=${evento.fecha_coordinada ?? fechaReserva}`}
        className="text-sm text-slate-400 hover:text-white"
      >
        ← Volver al día
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                esLlegada
                  ? "bg-sky-950 text-sky-300"
                  : "bg-orange-950 text-orange-300"
              }`}
            >
              {esLlegada ? "Llegada" : "Salida"}
            </span>
            {r.cancelada && (
              <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-xs font-medium text-red-300">
                Cancelada
              </span>
            )}
            {evento.estado === "hecho" && (
              <span className="rounded-full bg-emerald-950 px-2.5 py-0.5 text-xs font-medium text-emerald-300">
                Hecho
              </span>
            )}
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
            {r.huesped_nombre ?? "Sin nombre"}
          </h1>
          <p className="font-mono text-sm text-slate-400">{r.codigo_reserva}</p>
        </div>
        <form action={marcarHecho.bind(null, id, evento.estado !== "hecho")}>
          <button
            type="submit"
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
              evento.estado === "hecho"
                ? "border border-slate-700 text-slate-300 hover:bg-slate-800"
                : "bg-emerald-600 text-white hover:bg-emerald-500"
            }`}
          >
            {evento.estado === "hecho" ? "Reabrir" : "Marcar hecho"}
          </button>
        </form>
      </div>

      {/* Contacto: lo primero que se necesita en la calle */}
      {telefono ? (
        <div className="grid grid-cols-2 gap-3">
          <a
            href={`tel:+${telefono}`}
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-slate-100 text-base font-semibold text-slate-900 transition-colors hover:bg-white"
          >
            Llamar
          </a>
          <a
            href={`https://wa.me/${telefono}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-base font-semibold text-white transition-colors hover:bg-emerald-500"
          >
            WhatsApp
          </a>
        </div>
      ) : (
        <p className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-400">
          Sin teléfono cargado{r.cancelada && " (Airbnb lo borra al cancelar)"}.
        </p>
      )}

      {/* Alertas */}
      {imposible && (
        <p className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          <strong>Ventana insuficiente:</strong> con esos horarios no hay tiempo
          material para limpiar. Hay que negociar con uno de los dos huéspedes.
        </p>
      )}
      {esLlegada && (
        <p
          className={`rounded-lg px-4 py-3 text-sm ${
            listo
              ? "bg-emerald-950/60 text-emerald-200"
              : "bg-slate-800/60 text-slate-300"
          }`}
        >
          {listo
            ? "✓ Departamento listo: ya se limpió después de la última salida."
            : "El departamento todavía no figura limpio para esta llegada."}
        </p>
      )}

      {/* Estadía */}
      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-slate-700 bg-slate-800/60 p-4 sm:grid-cols-4">
        <Dato etiqueta={esLlegada ? "Entra (reserva)" : "Sale (reserva)"}>
          {fechaReserva ? formatearFechaAR(fechaReserva) : "—"}
        </Dato>
        <Dato etiqueta="Coordinado">
          {evento.fecha_coordinada
            ? `${formatearFechaAR(evento.fecha_coordinada)}${
                formatearHora(evento.hora_coordinada)
                  ? ` ${formatearHora(evento.hora_coordinada)}`
                  : ""
              }`
            : (formatearHora(evento.hora_coordinada) ?? "sin coordinar")}
        </Dato>
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
      </section>

      {/* Acceso */}
      <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Acceso</h2>

        {depto?.indicaciones_acceso && (
          <p className="whitespace-pre-wrap text-sm text-slate-400">
            {depto.indicaciones_acceso}
          </p>
        )}

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

        <FormularioCoordinar
          accion={coordinarEvento.bind(null, id)}
          opciones={opciones}
          valores={{
            acceso: accesoActual,
            fecha_coordinada: evento.fecha_coordinada ?? "",
            hora_coordinada: evento.hora_coordinada?.slice(0, 5) ?? "",
            observaciones: evento.observaciones ?? "",
            fechaReserva,
          }}
          avisoSelf={avisoSelf}
        />

        {/* La confirmación de dejar la llave es solo del check-in: en la
            salida la deja el huésped, no el equipo. */}
        {esLlegada && puntoElegido && METODOS_FISICOS.has(puntoElegido.metodo) && (
          <Interruptor
            etiqueta="Sobre / llave dejada"
            detalle="Confirmación de que el equipo ya lo dejó en el punto de acceso"
            activo={evento.acceso_dejado}
            accion={marcarAccesoDejado.bind(null, id)}
          />
        )}
      </section>

      {/* Pendientes: qué falta exactamente para dar esto por coordinado */}
      <section className="flex flex-col gap-2 rounded-xl border border-slate-800 p-4">
        <h2 className="font-medium text-white">Pendientes</h2>

        {faltantes.length === 0 ? (
          <p className="rounded-lg bg-emerald-950/60 px-3 py-2.5 text-sm font-medium text-emerald-200">
            ✓ Coordinado: no falta nada.
          </p>
        ) : (
          <ul className="flex flex-col gap-1 rounded-lg bg-amber-950/40 px-3 py-2.5">
            {faltantes.map((f) => (
              <li key={f} className="text-sm text-amber-200">
                • {f.charAt(0).toUpperCase() + f.slice(1)}
              </li>
            ))}
          </ul>
        )}

        {esLlegada ? (
          <>
            {depto?.requiere_registro ? (
              <Interruptor
                etiqueta="Registro de huéspedes"
                activo={r.registro_hecho}
                accion={marcarItem.bind(null, r.id, "registro_hecho")}
              />
            ) : (
              <p className="px-3 py-2 text-sm text-slate-600">
                Registro de huéspedes: no aplica
              </p>
            )}

            {depto?.requiere_aviso_seguridad ? (
              <Interruptor
                etiqueta="Aviso a seguridad"
                activo={r.aviso_seguridad_hecho}
                accion={marcarItem.bind(null, r.id, "aviso_seguridad_hecho")}
              />
            ) : (
              <p className="px-3 py-2 text-sm text-slate-600">
                Aviso a seguridad: no aplica
              </p>
            )}
          </>
        ) : (
          <Interruptor
            etiqueta="Late check-out"
            detalle="Ese día el departamento no se puede limpiar. Si no entra nadie, la limpieza se mueve sola al día siguiente."
            activo={evento.late_checkout}
            accion={alternarLateCheckout.bind(null, id)}
            color="alerta"
          />
        )}
      </section>

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
