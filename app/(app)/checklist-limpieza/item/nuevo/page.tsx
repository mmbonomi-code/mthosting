import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioItem from "../../FormularioItem";
import { crearItemChecklist } from "../../acciones";

export default async function NuevoItemChecklist() {
  const supabase = await crearClienteServidor();
  const { data: items } = await supabase.from("checklist_catalogo").select("seccion");
  const secciones = [...new Set((items ?? []).map((i) => i.seccion))].sort();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Nuevo ítem del checklist</h1>
      <FormularioItem accion={crearItemChecklist} secciones={secciones} />
    </main>
  );
}
