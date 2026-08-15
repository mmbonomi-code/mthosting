import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { rolDelUsuario } from "@/lib/permisos";
import { puedeEntrar } from "@/lib/secciones";
import {
  ETIQUETA_ACUERDO_PAGO,
  ETIQUETA_AMBIENTES,
  ETIQUETA_CANAL,
  ETIQUETA_SELF_CHECKOUT,
  ETIQUETA_TIPO_BANO,
} from "@/lib/etiquetas";
import BotonCopiar from "@/app/componentes/BotonCopiar";
import Wifi from "@/app/componentes/Wifi";
import FormularioAlias from "./FormularioAlias";
import { agregarAlias, alternarAlias } from "../acciones";

function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-tinta-tenue">
        {etiqueta}
      </dt>
      <dd className="text-base text-tinta">{children ?? "—"}</dd>
    </div>
  );
}

function Acordeon({
  titulo,
  resumen,
  children,
}: {
  titulo: string;
  resumen?: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md border border-borde">
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-tinta [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{titulo}</span>
        <span className="flex items-center gap-3">
          {resumen && (
            <span className="hidden max-w-64 truncate text-sm text-tinta-tenue sm:block">
              {resumen}
            </span>
          )}
          <span className="text-tinta-tenue transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <div className="border-t border-borde px-4 py-4">{children}</div>
    </details>
  );
}

export default async function FichaDepartamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: depto } = await supabase
    .from("departamentos")
    .select("*, propietario:propietarios(id, nombre)")
    .eq("id", id)
    .maybeSingle();

  if (!depto) notFound();

  const rol = await rolDelUsuario(supabase);
  const veCredenciales = rol === "admin" || rol === "manager";
  const puedeEditar = puedeEntrar(rol, `/departamentos/${id}/editar`);

  const [{ data: aliases }, { data: catalogo }, { data: inventario }, { data: banos }] =
    await Promise.all([
      supabase
        .from("listing_alias")
        .select("id, canal, nombre_listing, activo")
        .eq("depto_id", id)
        .order("created_at"),
      supabase
        .from("item_catalogo")
        .select("id, nombre, categoria, orden")
        .eq("activo", true)
        .order("categoria")
        .order("orden"),
      supabase
        .from("inventario_depto")
        .select("item_id, tiene, detalle")
        .eq("depto_id", id),
      supabase
        .from("banos_depto")
        .select("id, tipo, detalle")
        .eq("depto_id", id)
        .order("orden"),
    ]);

  const porItem = new Map((inventario ?? []).map((fila) => [fila.item_id, fila]));

  // Ítems del catálogo agrupados por categoría, con lo cargado de este depto.
  const grupos = (catalogo ?? []).reduce<
    Record<string, { nombre: string; tiene: boolean; detalle: string | null }[]>
  >((acumulado, item) => {
    const clave = item.categoria ?? "Otros";
    (acumulado[clave] ??= []).push({
      nombre: item.nombre,
      tiene: porItem.get(item.id)?.tiene ?? false,
      detalle: porItem.get(item.id)?.detalle ?? null,
    });
    return acumulado;
  }, {});

  const camas = [
    { etiqueta: "King", cantidad: depto.camas_king },
    { etiqueta: "Queen", cantidad: depto.camas_queen },
    { etiqueta: "Twin", cantidad: depto.camas_twin },
    { etiqueta: "Sillón cama", cantidad: depto.sillon_cama },
  ].filter((c) => (c.cantidad ?? 0) > 0);

  const cantidadBanos = (banos ?? []).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-tight text-tinta">
              {depto.codigo}
            </h1>
            {depto.estado === "suspendido" && (
              <span className="rounded-full bg-aviso-soft px-2.5 py-0.5 text-xs font-medium text-aviso-text">
                Suspendido
              </span>
            )}
            {!depto.activo && (
              <span className="rounded-full bg-warm-100 px-2.5 py-0.5 text-xs font-medium text-tinta-suave">
                Inactivo
              </span>
            )}
          </div>
          <p className="text-tinta-suave">{depto.nombre_interno}</p>
        </div>
        {/* Quien solo consulta la ficha no ve los botones que no puede abrir:
            si no, el enlace lo rebota y parece que el sistema falla. */}
        {puedeEditar && (
          <div className="flex gap-2">
            <Link
              href={`/departamentos/${id}/equipamiento`}
              className="rounded-md border border-borde-control px-4 py-2 text-sm font-medium text-tinta-suave transition-colors hover:bg-superficie-alt"
            >
              Equipamiento
            </Link>
            <Link
              href={`/departamentos/${id}/editar`}
              className="rounded-md border border-borde-control px-4 py-2 text-sm font-medium text-tinta-suave transition-colors hover:bg-superficie-alt"
            >
              Editar
            </Link>
          </div>
        )}
      </div>

      {/* Bloque fijo: lo más consultado (§3.5.quater) */}
      <dl className="grid grid-cols-2 gap-4 rounded-md border border-borde-control bg-superficie p-4 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-3">
          <Dato etiqueta="Dirección">{depto.direccion}</Dato>
        </div>
        <Dato etiqueta="Barrio">{depto.barrio}</Dato>
        <Dato etiqueta="Ambientes">
          {depto.ambientes ? ETIQUETA_AMBIENTES[depto.ambientes] : "—"}
        </Dato>
        <Dato etiqueta="Capacidad">
          {depto.capacidad ? `${depto.capacidad} personas` : "—"}
        </Dato>
        <div className="col-span-2 sm:col-span-3">
          <Dato etiqueta="Wifi">
            <Wifi
              ssid={depto.wifi_ssid}
              pass={depto.wifi_pass}
              velocidad={depto.wifi_velocidad}
            />
          </Dato>
        </div>
      </dl>

      <Acordeon
        titulo="Propiedad"
        resumen={depto.propietario?.nombre ?? "Sin propietario"}
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Propietario">{depto.propietario?.nombre}</Dato>
          <Dato etiqueta="Teléfono del propietario">
            {depto.propietario_telefono && (
              <a
                href={`tel:${depto.propietario_telefono}`}
                className="underline decoration-borde-fuerte underline-offset-4"
              >
                {depto.propietario_telefono}
              </a>
            )}
          </Dato>
          <Dato etiqueta="Encargado del edificio">
            {depto.encargado_nombre}
          </Dato>
          <Dato etiqueta="Teléfono del encargado">
            {depto.encargado_telefono && (
              <a
                href={`tel:${depto.encargado_telefono}`}
                className="underline decoration-borde-fuerte underline-offset-4"
              >
                {depto.encargado_telefono}
              </a>
            )}
          </Dato>
          <Dato etiqueta="Publicación">
            {depto.url_publicacion && (
              <a
                href={depto.url_publicacion}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-borde-fuerte underline-offset-4"
              >
                Abrir anuncio ↗
              </a>
            )}
          </Dato>
          <Dato etiqueta="Mapa">
            {depto.url_mapa && (
              <a
                href={depto.url_mapa}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-borde-fuerte underline-offset-4"
              >
                Abrir mapa ↗
              </a>
            )}
          </Dato>
          <Dato etiqueta="Comisión de MTHosting">
            {depto.comision_pct !== null ? `${depto.comision_pct}%` : "—"}
          </Dato>
          <Dato etiqueta="Acuerdo de pago">
            {depto.acuerdo_pago ? ETIQUETA_ACUERDO_PAGO[depto.acuerdo_pago] : "—"}
          </Dato>
          {/* Las credenciales de Airbnb son de manager y administración
              (decisión del dueño, 13/08/2026). Están guardadas en texto plano,
              así que la ficha no las muestra a nadie más: hasta ahora las veía
              cualquiera que abriera un departamento. */}
          {veCredenciales && (
            <>
              <Dato etiqueta="Usuario de Airbnb">
                {depto.airbnb_user && (
                  <span className="flex items-center gap-2">
                    <span className="font-mono">{depto.airbnb_user}</span>
                    <BotonCopiar texto={depto.airbnb_user} />
                  </span>
                )}
              </Dato>
              <div className="sm:col-span-2">
                <Dato etiqueta="Contraseña de Airbnb">
                  {depto.airbnb_pass && (
                    <span className="flex items-center gap-2">
                      <span className="font-mono">{depto.airbnb_pass}</span>
                      <BotonCopiar texto={depto.airbnb_pass} />
                    </span>
                  )}
                </Dato>
              </div>
            </>
          )}
        </dl>
      </Acordeon>

      <Acordeon
        titulo="Ambientes y camas"
        resumen={
          depto.total_camas || cantidadBanos
            ? `${depto.total_camas} ${depto.total_camas === 1 ? "cama" : "camas"} · ${cantidadBanos} ${cantidadBanos === 1 ? "baño" : "baños"}`
            : "Sin cargar"
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Ambientes (para limpieza)">
            {depto.ambientes ? ETIQUETA_AMBIENTES[depto.ambientes] : "—"}
          </Dato>
          <Dato etiqueta="Habitaciones">{depto.habitaciones ?? "—"}</Dato>
          <div className="sm:col-span-2">
            <Dato etiqueta={`Camas (total: ${depto.total_camas})`}>
              {camas.length > 0
                ? camas.map((c) => `${c.cantidad} ${c.etiqueta}`).join(" · ")
                : "Sin cargar"}
            </Dato>
          </div>
          <div className="sm:col-span-2">
            <Dato etiqueta={`Baños (${cantidadBanos})`}>
              {cantidadBanos > 0 ? (
                <ul className="flex flex-col gap-0.5">
                  {(banos ?? []).map((bano) => (
                    <li key={bano.id}>
                      {ETIQUETA_TIPO_BANO[bano.tipo]}
                      {bano.detalle && (
                        <span className="text-tinta-tenue"> — {bano.detalle}</span>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                "Sin cargar"
              )}
            </Dato>
          </div>
        </dl>
      </Acordeon>

      {Object.entries(grupos).map(([categoria, items]) => {
        const conQue = items.filter((i) => i.tiene);
        return (
          <Acordeon
            key={categoria}
            titulo={categoria}
            resumen={`${conQue.length} / ${items.length}`}
          >
            <ul className="flex flex-col gap-1.5">
              {items.map((item) => (
                <li
                  key={item.nombre}
                  className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5"
                >
                  <span
                    className={
                      item.tiene ? "text-tinta" : "text-tinta-tenue"
                    }
                  >
                    {item.tiene ? "✓" : "—"} {item.nombre}
                  </span>
                  {item.detalle && (
                    <span className="text-sm text-tinta-tenue">
                      {item.detalle}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Acordeon>
        );
      })}

      <Acordeon
        titulo="Requisitos de ingreso"
        resumen={
          [
            depto.requiere_registro ? "Registro" : null,
            depto.requiere_aviso_seguridad ? "Aviso a seguridad" : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Sin requisitos"
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2">
          <Dato etiqueta="Registro de huéspedes">
            {depto.requiere_registro ? "Requerido" : "No aplica"}
          </Dato>
          <Dato etiqueta="Aviso a seguridad">
            {depto.requiere_aviso_seguridad ? "Requerido" : "No aplica"}
          </Dato>
          <div className="sm:col-span-2">
            <Dato etiqueta="Self check-out">
              {ETIQUETA_SELF_CHECKOUT[depto.self_checkout]}
            </Dato>
          </div>
          <div className="sm:col-span-2">
            <Dato etiqueta="Indicaciones de acceso">
              {depto.indicaciones_acceso && (
                <span className="whitespace-pre-wrap">
                  {depto.indicaciones_acceso}
                </span>
              )}
            </Dato>
          </div>
        </dl>
      </Acordeon>

      <Acordeon
        titulo="Anuncios vinculados"
        resumen={`${(aliases ?? []).filter((a) => a.activo).length} activos`}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-tinta-tenue">
            Los nombres de anuncio con los que este departamento aparece en los
            archivos de reservas. Si un anuncio se renombra en Airbnb, agregá
            el nombre nuevo acá (o va a caer en la bandeja de sin asignar).
          </p>
          <ul className="flex flex-col gap-2">
            {(aliases ?? []).map((alias) => (
              <li
                key={alias.id}
                className="flex items-center justify-between gap-3 rounded-md border border-borde px-3 py-2"
              >
                <span className="min-w-0">
                  <span
                    className={`block truncate ${alias.activo ? "text-tinta" : "text-tinta-tenue line-through"}`}
                  >
                    {alias.nombre_listing}
                  </span>
                  <span className="text-xs text-tinta-tenue">
                    {ETIQUETA_CANAL[alias.canal]}
                  </span>
                </span>
                <form
                  action={alternarAlias.bind(null, alias.id, id, !alias.activo)}
                >
                  <button
                    type="submit"
                    className="shrink-0 rounded-md border border-borde-control px-2 py-1 text-xs text-tinta-suave transition-colors hover:bg-warm-100"
                  >
                    {alias.activo ? "Desactivar" : "Reactivar"}
                  </button>
                </form>
              </li>
            ))}
            {(aliases ?? []).length === 0 && (
              <li className="text-sm text-tinta-tenue">
                Todavía no hay anuncios vinculados.
              </li>
            )}
          </ul>
          <FormularioAlias accion={agregarAlias.bind(null, id)} />
        </div>
      </Acordeon>

      <Acordeon titulo="Observación" resumen={depto.observacion ?? undefined}>
        <p className="whitespace-pre-wrap text-tinta">
          {depto.observacion ?? "Sin observaciones."}
        </p>
      </Acordeon>
    </main>
  );
}
