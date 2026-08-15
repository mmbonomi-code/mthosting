import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEditarReservas } from "@/lib/reservas/permisos";
import { crearReserva } from "../acciones";
import FormularioReserva from "../FormularioReserva";
import SinPermiso from "../SinPermiso";

export default async function NuevaReserva({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string; depto?: string }>;
}) {
  const params = await searchParams;
  const supabase = await crearClienteServidor();

  if (!(await puedeEditarReservas(supabase))) return <SinPermiso />;

  const { data: departamentos } = await supabase
    .from("departamentos")
    .select("id, codigo, nombre_interno")
    .eq("estado", "activo")
    .order("codigo");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/dia" className="text-sm text-tinta-suave hover:text-tinta">
        ← Volver
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Cargar reserva
        </h1>
        <p className="text-sm text-tinta-suave">
          Para lo que no llega por la importación de Airbnb.
        </p>
      </div>

      <FormularioReserva
        accion={async (_previo, fd) => {
          "use server";
          return crearReserva(fd);
        }}
        valores={{
          codigo_reserva: "",
          depto_id: params.depto ?? "",
          huesped_nombre: "",
          huesped_contacto: "",
          fecha_checkin: params.fecha ?? "",
          fecha_checkout: "",
          adultos: "",
          ninos: "",
          bebes: "",
          payout_monto: "",
        }}
        departamentos={departamentos ?? []}
        esAlta
        avisoAirbnb={null}
        urlCancelar="/dia"
      />
    </main>
  );
}
