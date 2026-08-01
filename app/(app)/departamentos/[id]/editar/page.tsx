import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioDepartamento from "../../FormularioDepartamento";
import { actualizarDepartamento } from "../../acciones";

export default async function EditarDepartamento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: depto } = await supabase
    .from("departamentos")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!depto) notFound();

  const { data: propietarios } = await supabase
    .from("propietarios")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Editar {depto.codigo}
      </h1>
      <FormularioDepartamento
        accion={actualizarDepartamento.bind(null, id)}
        valores={depto}
        propietarios={propietarios ?? []}
        urlCancelar={`/departamentos/${id}`}
      />
    </main>
  );
}
