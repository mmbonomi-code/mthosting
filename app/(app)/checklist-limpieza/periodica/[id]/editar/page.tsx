import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioPeriodica from "../../../FormularioPeriodica";
import { actualizarTareaPeriodica } from "../../../acciones";

export default async function EditarTareaPeriodica({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: tarea } = await supabase
    .from("tareas_periodicas_catalogo")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!tarea) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{tarea.item}</h1>
      <FormularioPeriodica accion={actualizarTareaPeriodica.bind(null, id)} valores={tarea} />
    </main>
  );
}
