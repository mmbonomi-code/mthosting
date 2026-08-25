import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioItem from "../../../FormularioItem";
import { actualizarItemChecklist } from "../../../acciones";

export default async function EditarItemChecklist({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const [{ data: item }, { data: items }] = await Promise.all([
    supabase.from("checklist_catalogo").select("*").eq("id", id).maybeSingle(),
    supabase.from("checklist_catalogo").select("seccion"),
  ]);

  if (!item) notFound();
  const secciones = [...new Set((items ?? []).map((i) => i.seccion))].sort();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{item.item}</h1>
      <FormularioItem
        accion={actualizarItemChecklist.bind(null, id)}
        valores={item}
        secciones={secciones}
      />
    </main>
  );
}
