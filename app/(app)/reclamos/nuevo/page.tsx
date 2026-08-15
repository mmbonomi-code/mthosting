import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeGestionarReclamos } from "@/lib/reclamos/permisos";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import {
  plazosDeReclamo,
  semaforoDeReclamo,
  textoDePlazo,
  TONO_SEMAFORO,
} from "@/lib/reclamos/plazos";
import Badge from "@/app/componentes/Badge";
import { crearReclamo } from "../acciones";
import SinAcceso from "../SinAcceso";

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-tinta-tenue">{etiqueta}</dt>
      <dd className="text-base text-tinta">{children ?? "—"}</dd>
    </div>
  );
}

/**
 * Confirmación antes de crear. No se crea al abrir la página: entrar a una
 * dirección no puede dar de alta nada.
 */
export default async function NuevoReclamo({
  searchParams,
}: {
  searchParams: Promise<{ reserva?: string }>;
}) {
  const { reserva: reservaId } = await searchParams;
  if (!reservaId) redirect("/reclamos");

  const supabase = await crearClienteServidor();
  if (!(await puedeGestionarReclamos(supabase))) return <SinAcceso />;

  const { data: reserva } = await supabase
    .from("reservas")
    .select(
      `id, codigo_reserva, huesped_nombre, fecha_checkin, fecha_checkout, noches,
       depto:departamentos(codigo, nombre_interno)`,
    )
    .eq("id", reservaId)
    .maybeSingle();
  if (!reserva) notFound();

  // Un reclamo por reserva: si ya existe, se abre ese.
  const { data: existente } = await supabase
    .from("reclamos")
    .select("id")
    .eq("reserva_id", reservaId)
    .maybeSingle();
  if (existente) redirect(`/reclamos/${existente.id}`);

  const hoy = hoyAR();
  const estado = semaforoDeReclamo(reserva.fecha_checkout, "borrador", hoy);
  const plazos = reserva.fecha_checkout
    ? plazosDeReclamo(reserva.fecha_checkout, "borrador")
    : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/reclamos" className="text-sm text-tinta-suave hover:text-tinta">
        ← Volver a reclamos
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Nuevo reclamo
        </h1>
        <p className="text-sm text-tinta-suave">
          Reserva <span className="font-mono">{reserva.codigo_reserva}</span>
        </p>
      </div>

      <section className="flex flex-col gap-4 rounded-md border border-borde bg-superficie p-4">
        <p className="text-lg font-medium text-tinta">
          {reserva.huesped_nombre ?? "Sin nombre"}
        </p>
        <dl className="grid grid-cols-2 gap-4">
          <Dato etiqueta="Departamento">{reserva.depto?.codigo}</Dato>
          <Dato etiqueta="Código">
            <span className="font-mono">{reserva.codigo_reserva}</span>
          </Dato>
          <Dato etiqueta="Check-in">
            {reserva.fecha_checkin ? formatearFechaAR(reserva.fecha_checkin) : "—"}
          </Dato>
          <Dato etiqueta="Check-out">
            {reserva.fecha_checkout ? formatearFechaAR(reserva.fecha_checkout) : "—"}
          </Dato>
        </dl>

        {plazos ? (
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Badge tono={TONO_SEMAFORO[estado.semaforo]}>
              {textoDePlazo(estado.dias)}
            </Badge>
            <span className="text-tinta-suave">
              Centro de resoluciones hasta el {formatearFechaAR(plazos.limite_resolucion)}.
              Si el huésped no paga, AirCover hasta el{" "}
              {formatearFechaAR(plazos.limite_aircover)}.
            </span>
          </p>
        ) : (
          <p className="text-sm text-aviso-text">
            Esta reserva no tiene fecha de check-out, así que no se pueden calcular los
            plazos.
          </p>
        )}
      </section>

      <form action={crearReclamo.bind(null, reserva.id)}>
        <button
          type="submit"
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover"
        >
          Crear reclamo
        </button>
      </form>

      <p className="text-xs text-tinta-tenue">
        Se crea como borrador. El motivo y el monto se cargan en la ficha, y las fotos
        que haya subido la limpieza en ese check-out se adjuntan solas.
      </p>
    </main>
  );
}
