import { clsBoton } from "@/lib/ui";
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
import { rolDelUsuario } from "@/lib/permisos";
import { rolPuedeGestionarFotos } from "@/lib/limpiezas/permisos";
import { ETIQUETA_FOTO, TIPOS_FOTO } from "@/lib/limpiezas/fotos";
import { ARREGLO_RESUELTO } from "@/lib/alertas/detectar";
import Wifi from "@/app/componentes/Wifi";
import SubidorFotos from "@/app/(app)/mis-limpiezas/SubidorFotos";
import PendientesProvider from "@/app/(app)/mis-limpiezas/PendientesProvider";
import { BUCKET } from "@/app/(app)/mis-limpiezas/tipos";
import { FormularioAsignar, FormularioEditar } from "./FormulariosLimpieza";
import { reabrirArreglo, resolverArreglo } from "../arreglos";
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
      <dt className="text-xs uppercase tracking-wide text-tinta-etiqueta">{etiqueta}</dt>
      <dd className="text-base text-tinta-media">{children ?? "—"}</dd>
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

  const [
    { data: personas },
    { data: eventos },
    { data: anterior },
    rol,
    { data: fotos },
    { data: arreglosCrudos },
  ] = await Promise.all([
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
    rolDelUsuario(supabase),
    supabase.from("limpieza_fotos").select("id, tipo, storage_path").eq("limpieza_id", id),
    // Lo que la limpieza reportó para arreglar en ESTA limpieza.
    supabase
      .from("arreglos")
      .select("id, descripcion, estado, created_at")
      .eq("limpieza_id", id)
      .eq("activo", true)
      .order("created_at"),
  ]);

  // Fotos de la limpieza, para back office (spec Fase 2 §3). Se sirven por
  // URL firmada, igual que en la pantalla de la limpiadora: el bucket es
  // privado y nada sale por link público.
  const verFotos = rolPuedeGestionarFotos(rol);
  const rutas = (fotos ?? []).map((f) => f.storage_path);
  const { data: firmadas } =
    verFotos && rutas.length > 0
      ? await supabase.storage.from(BUCKET).createSignedUrls(rutas, 3600)
      : { data: [] as { path: string | null; signedUrl: string }[] };
  const urlPorRuta = new Map((firmadas ?? []).map((f) => [f.path, f.signedUrl]));
  const fotosDe = (tipo: string) =>
    (fotos ?? [])
      .filter((f) => f.tipo === tipo)
      .map((f) => ({ id: f.id, url: urlPorRuta.get(f.storage_path) ?? null }));

  const arreglos = verFotos ? (arreglosCrudos ?? []) : [];

  // El comprobante del viático vive en el mismo bucket privado que las fotos.
  const { data: firmaViatico } =
    verFotos && limpieza.viatico_comprobante
      ? await supabase.storage.from(BUCKET).createSignedUrl(limpieza.viatico_comprobante, 3600)
      : { data: null };
  const urlViatico = firmaViatico?.signedUrl ?? null;

  // La hora de salida sale de lo coordinado en el check-out; la cargada a
  // mano solo se usa cuando la limpieza no tiene reserva.
  const horaSalida =
    formatearHora(
      (eventos ?? []).find((e) => e.tipo === "checkout")?.hora_coordinada,
    ) ?? formatearHora(limpieza.hora_checkout);

  const proximoCheckin = limpieza.prox_checkin?.slice(0, 10) ?? null;
  const esMismoDia = proximoCheckin === limpieza.fecha;

  // Si el huésped que llega ese mismo día deja las valijas con la limpieza,
  // quien coordina y quien limpia tienen que saberlo (29/08/2026).
  const { data: llegadaMismoDia } =
    esMismoDia && limpieza.depto_id
      ? await supabase
          .from("reservas")
          .select(
            `id, eventos:eventos_estadia(
               tipo, hora_coordinada,
               punto:puntos_acceso!eventos_estadia_punto_acceso_id_fkey(recibe_limpieza)
             )`,
          )
          .eq("depto_id", limpieza.depto_id)
          .eq("cancelada", false)
          .eq("descartada", false)
          .eq("fecha_checkin", limpieza.fecha)
          .limit(1)
          .maybeSingle()
      : { data: null };

  const llegadaConValijas = (llegadaMismoDia?.eventos ?? []).find(
    (e) => e.tipo === "checkin" && e.punto?.recibe_limpieza,
  );
  const horaValijas = formatearHora(llegadaConValijas?.hora_coordinada ?? null);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/limpiezas" className="text-sm text-tinta-tenue hover:text-tinta">
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
            <span className="rounded-full bg-elevada-hover px-2.5 py-0.5 text-xs font-medium text-tinta-media">
              {ESTADOS_LIMPIEZA[limpieza.estado]}
            </span>
          </div>
          <p className="text-tinta-tenue">
            {formatearFechaAR(limpieza.fecha)} ·{" "}
            {TIPOS_LIMPIEZA[limpieza.tipo] ?? limpieza.tipo}
          </p>
        </div>
        {limpieza.estado === "cancelada" ? (
          <form action={reactivarLimpieza.bind(null, id)}>
            <button
              type="submit"
              className={clsBoton("secundario", "chico")}
            >
              Reactivar
            </button>
          </form>
        ) : (
          <form action={cancelarLimpieza.bind(null, id)}>
            <button
              type="submit"
              className="rounded-lg border border-error-borde px-4 py-2 text-sm font-medium text-error-text transition-colors hover:bg-error-soft"
            >
              Cancelar limpieza
            </button>
          </form>
        )}
      </div>

      {/* Lo que hace falta para ir a trabajar */}
      <dl className="grid grid-cols-2 gap-4 rounded-xl border border-borde-control bg-superficie-alt p-4 sm:grid-cols-3">
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

      {llegadaConValijas && (
        <p className="rounded-xl bg-dato-soft/60 px-4 py-3 text-sm text-dato-text-fuerte">
          🧳 El huésped que llega{horaValijas ? " a las " + horaValijas : ""} deja
          las valijas con la limpieza.
        </p>
      )}

      {/* Asignación */}
      <section className="flex flex-col gap-3 rounded-xl border border-borde p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium text-tinta">Responsable</h2>
          {limpieza.monto_pactado !== null && (
            <span className="text-sm text-tinta-tenue">
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
                className="rounded-md border border-borde-control px-2 py-1 text-xs text-tinta-suave transition-colors hover:bg-elevada-hover"
              >
                Recalcular monto
              </button>
            </form>
            <span className="text-xs text-tinta-apagada">
              El monto se congela al asignar; recalculalo si cambiaste el tipo o
              la fecha.
            </span>
          </div>
        )}
        {anterior && (
          <p className="text-xs text-tinta-etiqueta">
            La última vez la limpió {anterior.responsable?.nombre ?? "alguien sin registrar"} el{" "}
            {formatearFechaAR(anterior.fecha)}.
          </p>
        )}
      </section>

      {/* Reserva */}
      {limpieza.reserva && (
        <section className="flex flex-col gap-3 rounded-xl border border-borde p-4">
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
        <section className="flex flex-col gap-3 rounded-xl border border-borde p-4">
          <h2 className="font-medium text-tinta">Acceso</h2>
          {limpieza.depto?.encargado_nombre && (
            <p className="text-sm text-tinta-suave">
              Encargado: {limpieza.depto.encargado_nombre}
              {limpieza.depto.encargado_telefono && (
                <a
                  href={`tel:${limpieza.depto.encargado_telefono}`}
                  className="ml-2 underline decoration-tinta-apagada underline-offset-4"
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

      {/* Fotos y lo que dejó anotado quien limpió (spec Fase 2 §2.7 y §3) */}
      {verFotos && (
        <section className="flex flex-col gap-4 rounded-xl border border-borde p-4">
          <div>
            <h2 className="font-medium text-tinta">Fotos</h2>
            <p className="text-xs text-tinta-etiqueta">
              Las que sacó quien limpió. Podés sumar las tuyas.
            </p>
          </div>
          {/* El proveedor también acá: el subidor guarda la foto en el
              navegador antes de subirla, y necesita su cola. De paso, si a
              back office se le corta internet tampoco pierde lo que cargó. */}
          <PendientesProvider>
            {TIPOS_FOTO.map((t) => (
              <SubidorFotos
                key={t}
                fotos={fotosDe(t)}
                limpiezaId={id}
                tipo={t}
                etiqueta={ETIQUETA_FOTO[t]}
              />
            ))}
          </PendientesProvider>
          {limpieza.observacion_proxima && (
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-tinta-etiqueta">
                Observación para la próxima limpieza
              </span>
              <p className="whitespace-pre-wrap rounded-lg bg-fondo/60 px-3 py-2 text-sm italic text-tinta-suave">
                {limpieza.observacion_proxima}
              </p>
            </div>
          )}

          {/* Lo que la limpieza reportó para arreglar. Antes esto se guardaba
              en la base y no lo leía ninguna pantalla. */}
          {arreglos.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-tinta-etiqueta">
                Reportado para arreglar
              </span>
              {arreglos.map((a) => {
                const resuelto = a.estado === ARREGLO_RESUELTO;
                return (
                  <div
                    key={a.id}
                    className={`flex flex-wrap items-start justify-between gap-3 rounded-lg px-3 py-2 ${
                      resuelto ? "bg-fondo/60" : "bg-error-soft/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p
                        className={`whitespace-pre-wrap text-sm ${
                          resuelto ? "text-tinta-etiqueta line-through" : "text-error-text-fuerte"
                        }`}
                      >
                        {a.descripcion}
                      </p>
                      <p className="text-xs text-tinta-etiqueta">
                        {formatearFechaAR(a.created_at.slice(0, 10))}
                      </p>
                    </div>
                    <form
                      action={
                        resuelto
                          ? reabrirArreglo.bind(null, a.id, id)
                          : resolverArreglo.bind(null, a.id, id)
                      }
                    >
                      <button
                        type="submit"
                        className="h-9 shrink-0 rounded-md border border-borde-control px-3 text-xs font-medium text-tinta-suave transition-colors hover:bg-elevada-hover"
                      >
                        {resuelto ? "Reabrir" : "Marcar resuelto"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </div>
          )}

          {/* Viático: plata que la persona adelantó de su bolsillo. Por ahora
              solo se muestra; la aprobación va con el pago al personal
              (decisión del dueño, 29/08/2026). */}
          {(limpieza.viatico_monto !== null || urlViatico) && (
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wide text-tinta-etiqueta">
                Viático
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-base font-semibold text-tinta-media">
                  {limpieza.viatico_monto !== null
                    ? `${limpieza.moneda ?? "ARS"} ${limpieza.viatico_monto.toLocaleString("es-AR")}`
                    : "sin monto cargado"}
                </span>
                {urlViatico && (
                  <a
                    href={urlViatico}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-tinta-suave underline decoration-tinta-apagada underline-offset-4 hover:text-tinta"
                  >
                    Ver comprobante
                  </a>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Edición */}
      <section className="flex flex-col gap-3 rounded-xl border border-borde p-4">
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
