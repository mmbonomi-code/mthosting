import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeGestionarReclamos } from "@/lib/reclamos/permisos";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import {
  DIAS_REALES_AIRBNB,
  plazosDeReclamo,
  semaforoDeReclamo,
  textoDePlazo,
  TEXTO_SEMAFORO,
  type EstadoReclamo,
} from "@/lib/reclamos/plazos";
import { ESTADOS_FINALES, ETIQUETA_ESTADO } from "@/lib/reclamos/estados";
import { ETIQUETA_CATEGORIA } from "@/lib/reclamos/categorias";
import { formatearMonto } from "@/lib/reclamos/lista";
import Acordeon from "./Acordeon";
import AccionesEstado from "./AccionesEstado";
import DetalleReclamo from "./DetalleReclamo";
import Evidencia, { type FotoEnFicha } from "./Evidencia";
import SinAcceso from "../SinAcceso";
import { BUCKET } from "@/lib/reclamos/storage";
import {
  cambiarEstado,
  guardarDetalle,
  ocultarEvidencia,
  reabrirReclamo,
  subirEvidencia,
} from "../acciones";

/** Las URLs firmadas duran lo que dura mirar la ficha. */
const MINUTOS_DE_FIRMA = 60;

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="text-base text-slate-200">{children ?? "—"}</dd>
    </div>
  );
}

function momento(instante: string | null): string {
  if (!instante) return "—";
  const d = new Date(instante);
  return d.toLocaleString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FichaReclamo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  if (!(await puedeGestionarReclamos(supabase))) return <SinAcceso />;

  const { data: reclamo } = await supabase
    .from("reclamos")
    .select(
      `id, estado, categoria, motivo, monto_reclamado, monto_cobrado, moneda,
       url_airbnb, presentado_at, escalado_at, resuelto_at, nota_interna,
       created_at, creado_por,
       reserva:reservas(
         id, codigo_reserva, huesped_nombre, huesped_contacto, noches,
         adultos, ninos, fecha_checkin, fecha_checkout,
         depto:departamentos(codigo, nombre_interno, barrio)
       )`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!reclamo?.reserva) notFound();

  const r = reclamo.reserva;
  const depto = r.depto;
  const estado = reclamo.estado as EstadoReclamo;
  const cerrado = ESTADOS_FINALES.has(estado);
  const hoy = hoyAR();

  const plazo = semaforoDeReclamo(r.fecha_checkout, estado, hoy);
  const plazos = r.fecha_checkout ? plazosDeReclamo(r.fecha_checkout, estado) : null;

  const [{ data: fotos }, { data: { user } }, { data: quienCargo }] = await Promise.all([
    supabase
      .from("reclamo_fotos")
      .select("id, storage_path, origen, tomada_at")
      .eq("reclamo_id", id)
      .eq("activo", true)
      .order("orden"),
    supabase.auth.getUser(),
    reclamo.creado_por
      ? supabase
          .from("personas")
          .select("nombre")
          .eq("profile_id", reclamo.creado_por)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // El bucket es privado: cada archivo se sirve con una firma de corta vida.
  const rutas = (fotos ?? []).map((f) => f.storage_path);
  const { data: firmadas } = rutas.length
    ? await supabase.storage.from(BUCKET).createSignedUrls(rutas, MINUTOS_DE_FIRMA * 60)
    : { data: [] };
  const urlPorRuta = new Map(
    (firmadas ?? []).map((f) => [f.path ?? "", f.signedUrl as string | null]),
  );

  const evidencia: FotoEnFicha[] = (fotos ?? []).map((f) => ({
    id: f.id,
    nombre: f.storage_path.split("/").pop() ?? f.storage_path,
    url: urlPorRuta.get(f.storage_path) ?? null,
    esPdf: f.storage_path.toLowerCase().endsWith(".pdf"),
    origen: f.origen as "limpieza" | "manual",
    tomada_at: f.tomada_at,
  }));

  const { data: yo } = await supabase
    .from("personas")
    .select("rol")
    .eq("profile_id", user!.id)
    .maybeSingle();

  // La línea de tiempo: lo que ya pasó, con fecha; lo que falta, en gris.
  const hitos = [
    { titulo: "Cargado", cuando: reclamo.created_at, hecho: true },
    {
      titulo: "Presentado en el Centro de resoluciones",
      cuando: reclamo.presentado_at,
      hecho: reclamo.presentado_at !== null,
    },
    {
      titulo: "Escalado a AirCover",
      cuando: reclamo.escalado_at,
      hecho: reclamo.escalado_at !== null,
    },
    {
      titulo:
        estado === "rechazado"
          ? "Rechazado"
          : estado === "descartado"
            ? "Descartado"
            : "Cobrado",
      cuando: reclamo.resuelto_at,
      hecho: reclamo.resuelto_at !== null || estado === "descartado",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/reclamos" className="text-sm text-slate-400 hover:text-white">
        ← Volver a reclamos
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-200">
            {ETIQUETA_ESTADO[estado]}
          </span>
          <span className="text-sm text-slate-500">
            {ETIQUETA_CATEGORIA[reclamo.categoria] ?? reclamo.categoria}
          </span>
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">
          {r.huesped_nombre ?? "Sin nombre"}
          <span className="ml-3 font-mono text-lg font-normal text-emerald-300">
            {depto?.codigo}
          </span>
        </h1>
      </div>

      {/* Bloque fijo: lo que viene de la reserva y no se edita acá */}
      <section className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Dato etiqueta="Código">
            <span className="font-mono">{r.codigo_reserva}</span>
          </Dato>
          <Dato etiqueta="Departamento">{depto?.codigo}</Dato>
          <Dato etiqueta="Check-in">
            {r.fecha_checkin ? formatearFechaAR(r.fecha_checkin) : "—"}
          </Dato>
          <Dato etiqueta="Check-out">
            {r.fecha_checkout ? formatearFechaAR(r.fecha_checkout) : "—"}
          </Dato>
        </dl>

        {plazos ? (
          <div
            className={`rounded-lg bg-slate-900/60 px-3 py-2.5 text-sm ${
              TEXTO_SEMAFORO[plazo.semaforo]
            }`}
          >
            <strong>{textoDePlazo(plazo.dias)}</strong>
            <p className="text-slate-400">
              Centro de resoluciones hasta el{" "}
              {formatearFechaAR(plazos.limite_resolucion)}: un día antes de que Airbnb
              cierre los {DIAS_REALES_AIRBNB} del check-out. AirCover hasta el{" "}
              {formatearFechaAR(plazos.limite_aircover)}.
            </p>
          </div>
        ) : (
          <p className="rounded-lg bg-amber-950/40 px-3 py-2.5 text-sm text-amber-200">
            La reserva no tiene fecha de check-out: no se pueden calcular los plazos.
          </p>
        )}

        {reclamo.url_airbnb && (
          <a
            href={reclamo.url_airbnb}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
          >
            Abrir el caso en Airbnb ↗
          </a>
        )}
      </section>

      <Acordeon titulo="Detalle del reclamo">
        <DetalleReclamo
          guardar={guardarDetalle.bind(null, id)}
          valores={{
            motivo: reclamo.motivo ?? "",
            monto_reclamado:
              reclamo.monto_reclamado === null ? "" : String(reclamo.monto_reclamado),
            categoria: reclamo.categoria,
            nota_interna: reclamo.nota_interna ?? "",
            url_airbnb: reclamo.url_airbnb ?? "",
          }}
          soloLectura={cerrado}
        />
        {reclamo.monto_cobrado !== null && (
          <p className="mt-3 rounded-lg bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
            Cobrado {formatearMonto(reclamo.monto_cobrado, reclamo.moneda)} de{" "}
            {formatearMonto(reclamo.monto_reclamado, reclamo.moneda)} reclamados.
          </p>
        )}
      </Acordeon>

      <Acordeon titulo="Evidencia" contador={evidencia.length}>
        <Evidencia
          fotos={evidencia}
          subir={subirEvidencia.bind(null, id)}
          ocultar={ocultarEvidencia.bind(null, id)}
          soloLectura={cerrado}
        />
      </Acordeon>

      <Acordeon titulo="Seguimiento">
        <ol className="flex flex-col gap-3">
          {hitos.map((h) => (
            <li key={h.titulo} className="flex gap-3">
              <span
                className={`mt-1 size-3 shrink-0 rounded-full border-2 ${
                  h.hecho
                    ? "border-emerald-500 bg-emerald-500"
                    : "border-slate-600 bg-transparent"
                }`}
              />
              <span className="min-w-0">
                <span
                  className={`block text-sm ${h.hecho ? "text-slate-200" : "text-slate-500"}`}
                >
                  {h.titulo}
                </span>
                <span className="block text-xs text-slate-500">
                  {h.hecho ? momento(h.cuando) : "Pendiente"}
                  {h.titulo === "Cargado" && quienCargo?.nombre && ` · ${quienCargo.nombre}`}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </Acordeon>

      <AccionesEstado
        estado={estado}
        urlAirbnb={reclamo.url_airbnb ?? ""}
        montoReclamado={reclamo.monto_reclamado}
        cambiar={cambiarEstado.bind(null, id)}
        reabrir={reabrirReclamo.bind(null, id)}
        esAdmin={yo?.rol === "admin"}
      />
    </main>
  );
}
