import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioPersona from "../../FormularioPersona";
import { actualizarPersona } from "../../acciones";

export default async function EditarPersona({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!persona) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {persona.nombre}
      </h1>
      <FormularioPersona
        accion={actualizarPersona.bind(null, id)}
        valores={persona}
        urlCancelar="/personas"
      />
    </main>
  );
}
