import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioPuntoAcceso from "../../FormularioPuntoAcceso";
import { actualizarPuntoAcceso } from "../../acciones";

export default async function EditarPuntoAcceso({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: punto } = await supabase
    .from("puntos_acceso")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!punto) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {punto.ubicacion}
      </h1>
      <FormularioPuntoAcceso
        accion={actualizarPuntoAcceso.bind(null, id)}
        valores={punto}
        urlCancelar="/puntos-acceso"
      />
    </main>
  );
}
