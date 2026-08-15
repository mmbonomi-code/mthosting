import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR } from "@/lib/fechas";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import {
  ESTADOS_LIMPIEZA,
  TIPOS_LIMPIEZA,
  formatearHora,
} from "@/lib/limpiezas/etiquetas";
import Wifi from "@/app/componentes/Wifi";
import { FormularioAsignar, FormularioEditar } from "./FormulariosLimpieza";
import {
  asignarResponsable,
  cancelarLimpieza,
  editarLimpieza,
  reactivarLimpieza,
  recalcularMonto,
} from "../acciones";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-tinta-tenue">{etiqueta}</dt>
      <dd className="text-base text-tinta">{children ?? "—"}</dd>
    </div>
  );
}

export default async function FichaLimpieza({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: limpieza } = await supabase
    .from("limpiezas")
    .select(
      "*, depto:departamentos(id, codigo, nombre_interno, direccion, barrio, ambientes, capacidad, total_camas, wifi_ssid, wifi_pass, encargado_nombre, encargado_telefono, indicaciones_acceso), reserva:reservas(codigo_reserva, huesped_nombre, huesped_contacto, noches, fecha_checkin, fecha_checkout), responsable:personas(id, nombre)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!limpieza) notFound();

  const [{ data: personas }, { data: eventos }, { data: anterior }] = await Promise.all([
    supabase
      .from("personas")
      .select("id, nombre")
      .eq("hace_limpieza", true)
      .eq("activo", true)
      .order("nombre"),
    limpieza.reserva
      ? supabase
          .from("eventos_estadia")
          .select("tipo, hora_coordinada, fecha_coordinada, reserva:reservas!inner(codigo_reserva)")
          .eq("reservas.codigo_reserva", limpieza.reserva.codigo_reserva)
      : Promise.resolve({ data: null }),
    // Quién limpió este departamento la última vez (spec §3.2).
    supabase
      .from("limpiezas")
      .select("fecha, responsable:personas(nombre)")
      .eq("depto_id", limpieza.depto_id)
      .lt("fecha", limpieza.fecha)
      .in("estado", ["hecha", "verificada"])
      .order("fecha", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // La hora de salida sale de lo coordinado en el check-out; la cargada a
  // mano solo se usa cuando la limpieza no tiene reserva.
  const horaSalida =
    formatearHora(
      (eventos ?? []).find((e) => e.tipo === "checkout")?.hora_coordinada,
    ) ?? formatearHora(limpieza.hora_checkout);

  const proximoCheckin = limpieza.prox_checkin?.slice(0, 10) ?? null;
  const esMismoDia = proximoCheckin === limpieza.fecha;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/limpiezas" className="text-sm text-tinta-suave hover:text-tinta">
        ← Volver a limpiezas
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-tinta">
              {limpieza.depto?.codigo}
            </h1>
            {esMismoDia && (
              <span className="rounded-full bg-error-soft px-2.5 py-0.5 text-xs font-medium text-error-text">
                Check in/out
              </span>
            )}
            <span className="rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-tinta">
              {ESTADOS_LIMPIEZA[limpieza.estado]}
            </span>
          </div>
          <p className="text-tinta-suave">
            {formatearFechaAR(limpieza.fecha)} ·{" "}
            {TIPOS_LIMPIEZA[limpieza.tipo] ?? limpieza.tipo}
          </p>
        </div>
        {limpieza.estado === "cancelada" ? (
          <form action={reactivarLimpieza.bind(null, id)}>
            <button
              type="submit"
              className="rounded-md border border-borde-control px-4 py-2 text-sm font-medium text-tinta-suave transition-colors hover:bg-superficie-alt"
            >
              Reactivar
            </button>
          </form>
        ) : (
          <form action={cancelarLimpieza.bind(null, id)}>
            <button
              type="submit"
              className="rounded-md border border-error px-4 py-2 text-sm font-medium text-error-text transition-colors hover:bg-error-soft"
            >
              Cancelar limpieza
            </button>
          </form>
        )}
      </div>

      {/* Lo que hace falta para ir a trabajar */}
      <dl className="grid grid-cols-2 gap-4 rounded-md border border-borde-control bg-superficie p-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <Dato etiqueta="Dirección">{limpieza.depto?.direccion}</Dato>
        </div>
        <Dato etiqueta="Barrio">{limpieza.depto?.barrio}</Dato>
        <Dato etiqueta="Ambientes">
          {limpieza.depto?.ambientes ? ETIQUETA_AMBIENTES[limpieza.depto.ambientes] : "—"}
        </Dato>
        <Dato etiqueta="Camas">{limpieza.depto?.total_camas || "—"}</Dato>
        <Dato etiqueta="Sale">{horaSalida ?? "sin hora"}</Dato>
        <Dato etiqueta="Próximo huésped">
          {proximoCheckin ? formatearFechaAR(proximoCheckin) : "sin reserva próxima"}
        </Dato>
        <Dato etiqueta="Capacidad">
          {limpieza.depto?.capacidad ? `${limpieza.depto.capacidad} pers.` : "—"}
        </Dato>
        <div className="col-span-2 sm:col-span-3">
          <Dato etiqueta="Wifi">
            <Wifi
              ssid={limpieza.depto?.wifi_ssid ?? null}
              pass={limpieza.depto?.wifi_pass ?? null}
            />
          </Dato>
        </div>
      </dl>

      {/* Asignación */}
      <section className="flex flex-col gap-3 rounded-md border border-borde p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium text-tinta">Responsable</h2>
          {limpieza.monto_pactado !== null && (
            <span className="text-sm text-tinta-suave">
              {limpieza.moneda} {limpieza.monto_pactado}
              {limpieza.pago_doble && (
                <span className="ml-2 rounded-full bg-exito-soft px-2 py-0.5 text-xs text-exito-text">
                  pago doble
                </span>
              )}
            </span>
          )}
        </div>
        <FormularioAsignar
          accion={asignarResponsable.bind(null, id)}
          personas={personas ?? []}
          asignadoA={limpieza.responsable?.id ?? null}
        />
        {limpieza.responsable && (
          <div className="flex flex-wrap items-center gap-3">
            {limpieza.monto_pactado === null && (
              <p className="text-xs text-aviso-text">
                Sin monto: no hay valores cargados para este departamento a esa
                fecha.
              </p>
            )}
            <form action={recalcularMonto.bind(null, id)}>
              <button
                type="submit"
                className="rounded-md border border-borde-control px-2 py-1 text-xs text-tinta-suave transition-colors hover:bg-warm-100"
              >
                Recalcular monto
              </button>
            </form>
            <span className="text-xs text-tinta-tenue">
              El monto se congela al asignar; recalculalo si cambiaste el tipo o
              la fecha.
            </span>
          </div>
        )}
        {anterior && (
          <p className="text-xs text-tinta-tenue">
            La última vez la limpió {anterior.responsable?.nombre ?? "alguien sin registrar"} el{" "}
            {formatearFechaAR(anterior.fecha)}.
          </p>
        )}
      </section>

      {/* Reserva */}
      {limpieza.reserva && (
        <section className="flex flex-col gap-3 rounded-md border border-borde p-4">
          <h2 className="font-medium text-tinta">Reserva</h2>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Dato etiqueta="Código">{limpieza.reserva.codigo_reserva}</Dato>
            <Dato etiqueta="Huésped">{limpieza.reserva.huesped_nombre}</Dato>
            <Dato etiqueta="Noches">{limpieza.reserva.noches}</Dato>
            <div className="sm:col-span-3">
              <Dato etiqueta="Estadía">
                {limpieza.reserva.fecha_checkin
                  ? `${formatearFechaAR(limpieza.reserva.fecha_checkin)} → ${
                      limpieza.reserva.fecha_checkout
                        ? formatearFechaAR(limpieza.reserva.fecha_checkout)
                        : "—"
                    }`
                  : "—"}
              </Dato>
            </div>
          </dl>
        </section>
      )}

      {/* Acceso */}
      {(limpieza.depto?.indicaciones_acceso || limpieza.depto?.encargado_nombre) && (
        <section className="flex flex-col gap-3 rounded-md border border-borde p-4">
          <h2 className="font-medium text-tinta">Acceso</h2>
          {limpieza.depto?.encargado_nombre && (
            <p className="text-sm text-tinta-suave">
              Encargado: {limpieza.depto.encargado_nombre}
              {limpieza.depto.encargado_telefono && (
                <a
                  href={`tel:${limpieza.depto.encargado_telefono}`}
                  className="ml-2 underline decoration-borde-fuerte underline-offset-4"
                >
                  {limpieza.depto.encargado_telefono}
                </a>
              )}
            </p>
          )}
          {limpieza.depto?.indicaciones_acceso && (
            <p className="whitespace-pre-wrap text-sm text-tinta-suave">
              {limpieza.depto.indicaciones_acceso}
            </p>
          )}
        </section>
      )}

      {/* Edición */}
      <section className="flex flex-col gap-3 rounded-md border border-borde p-4">
        <h2 className="font-medium text-tinta">Datos de la limpieza</h2>
        <FormularioEditar
          accion={editarLimpieza.bind(null, id)}
          valores={{
            fecha: limpieza.fecha,
            tipo: limpieza.tipo,
            notas: limpieza.notas,
          }}
        />
      </section>
    </main>
  );
}
