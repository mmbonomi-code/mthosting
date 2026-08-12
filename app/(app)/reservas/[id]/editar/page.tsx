import Link from "next/link";
import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEditarReservas } from "@/lib/reservas/permisos";
import { airbnbPisaLoEditado } from "@/lib/reservas/validar";
import { formatearFechaAR } from "@/lib/fechas";
import { editarReserva } from "../../acciones";
import FormularioReserva from "../../FormularioReserva";
import SinPermiso from "../../SinPermiso";

const ORIGEN: Record<string, string> = {
  csv: "importada del archivo de Airbnb",
  ical: "descubierta por el calendario",
  manual: "cargada a mano",
};

export default async function EditarReserva({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creada?: string }>;
}) {
  const { id } = await params;
  const { creada } = await searchParams;
  const supabase = await crearClienteServidor();

  if (!(await puedeEditarReservas(supabase))) return <SinPermiso />;

  const [{ data: reserva }, { data: departamentos }] = await Promise.all([
    supabase
      .from("reservas")
      .select(
        `id, codigo_reserva, canal, origen, datos_completos, depto_id,
         huesped_nombre, huesped_contacto, adultos, ninos, bebes, noches,
         fecha_checkin, fecha_checkout, payout_monto, cancelada, descartada,
         eventos:eventos_estadia(id, tipo)`,
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("departamentos")
      .select("id, codigo, nombre_interno")
      .eq("estado", "activo")
      .order("codigo"),
  ]);

  if (!reserva) notFound();

  // §2.10.bis: hay que advertirlo ANTES de editar, no descubrirlo después.
  const loPisaAirbnb = airbnbPisaLoEditado(reserva.origen, reserva.codigo_reserva);
  const aviso = loPisaAirbnb
    ? "Estos datos vienen de Airbnb. Lo que edites acá es un arreglo temporal: la próxima importación que traiga esta reserva lo reemplaza con lo que diga el archivo. Sirve justamente para eso, para trabajar mientras tanto."
    : null;

  // Para volver a donde se estaba: la llegada de esta misma reserva.
  const evento =
    reserva.eventos?.find((e) => e.tipo === "checkin") ?? reserva.eventos?.[0];
  const urlVolver = evento ? `/dia/${evento.id}` : "/dia";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href={urlVolver} className="text-sm text-slate-400 hover:text-white">
        ← Volver
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {creada ? "Reserva creada" : "Editar reserva"}
        </h1>
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-slate-400">
          <span className="font-mono">{reserva.codigo_reserva}</span>
          <span>· {ORIGEN[reserva.origen] ?? reserva.origen}</span>
          {!reserva.datos_completos && (
            <span className="rounded-full bg-violet-950 px-2 py-0.5 text-xs text-violet-300">
              Tentativa
            </span>
          )}
          {reserva.cancelada && (
            <span className="rounded-full bg-red-950 px-2 py-0.5 text-xs text-red-300">
              Cancelada
            </span>
          )}
        </p>
      </div>

      {creada && (
        <p className="rounded-lg bg-emerald-950/60 px-4 py-3 text-sm text-emerald-200">
          ✓ Ya están armados el check-in, el check-out y la limpieza.{" "}
          {reserva.fecha_checkin && (
            <>Entra el {formatearFechaAR(reserva.fecha_checkin)}.</>
          )}
        </p>
      )}

      {!reserva.datos_completos && (
        <p className="rounded-lg bg-violet-950/40 px-4 py-3 text-sm text-violet-200">
          Esta reserva la trajo el calendario, así que solo se conocen las fechas.
          Cargale el nombre y el teléfono y deja de figurar como tentativa.
        </p>
      )}

      <FormularioReserva
        accion={async (_previo, fd) => {
          "use server";
          return editarReserva(id, fd);
        }}
        valores={{
          codigo_reserva: reserva.codigo_reserva,
          depto_id: reserva.depto_id ?? "",
          huesped_nombre: reserva.huesped_nombre ?? "",
          huesped_contacto: reserva.huesped_contacto ?? "",
          fecha_checkin: reserva.fecha_checkin ?? "",
          fecha_checkout: reserva.fecha_checkout ?? "",
          adultos: reserva.adultos === null ? "" : String(reserva.adultos),
          ninos: reserva.ninos === null ? "" : String(reserva.ninos),
          bebes: reserva.bebes === null ? "" : String(reserva.bebes),
          payout_monto:
            reserva.payout_monto === null ? "" : String(reserva.payout_monto),
        }}
        departamentos={departamentos ?? []}
        esAlta={false}
        avisoAirbnb={aviso}
        urlCancelar={urlVolver}
      />
    </main>
  );
}
