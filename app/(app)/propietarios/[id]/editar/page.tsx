import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioPropietario from "../../FormularioPropietario";
import { actualizarPropietario } from "../../acciones";

export default async function EditarPropietario({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: propietario } = await supabase
    .from("propietarios")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!propietario) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">
        Editar propietario
      </h1>
      <FormularioPropietario
        accion={actualizarPropietario.bind(null, id)}
        valores={propietario}
        urlCancelar="/propietarios"
      />
    </main>
  );
}
