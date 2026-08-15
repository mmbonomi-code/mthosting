import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioEquipamiento, {
  type ItemEquipamiento,
} from "./FormularioEquipamiento";
import { guardarEquipamiento } from "../../acciones";

export default async function EditarEquipamiento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: depto } = await supabase
    .from("departamentos")
    .select("codigo")
    .eq("id", id)
    .maybeSingle();

  if (!depto) notFound();

  const [{ data: catalogo }, { data: cargado }] = await Promise.all([
    supabase
      .from("item_catalogo")
      .select("id, nombre, categoria, orden")
      .eq("activo", true)
      .order("categoria")
      .order("orden"),
    supabase
      .from("inventario_depto")
      .select("item_id, tiene, detalle")
      .eq("depto_id", id),
  ]);

  const porItem = new Map(
    (cargado ?? []).map((fila) => [fila.item_id, fila]),
  );

  const items: ItemEquipamiento[] = (catalogo ?? []).map((item) => ({
    id: item.id,
    nombre: item.nombre,
    categoria: item.categoria,
    tiene: porItem.get(item.id)?.tiene ?? false,
    detalle: porItem.get(item.id)?.detalle ?? null,
  }));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Equipamiento de {depto.codigo}
        </h1>
        <p className="text-sm text-tinta-suave">
          Marcá lo que tiene el departamento. El detalle es opcional (marca,
          color, ubicación…).
        </p>
      </div>
      <FormularioEquipamiento
        accion={guardarEquipamiento.bind(null, id)}
        items={items}
        urlCancelar={`/departamentos/${id}`}
      />
    </main>
  );
}
