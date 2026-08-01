import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioDepartamento from "../FormularioDepartamento";
import { crearDepartamento } from "../acciones";

export default async function NuevoDepartamento() {
  const supabase = await crearClienteServidor();
  const { data: propietarios } = await supabase
    .from("propietarios")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Nuevo departamento
      </h1>
      <FormularioDepartamento
        accion={crearDepartamento}
        propietarios={propietarios ?? []}
        urlCancelar="/departamentos"
      />
    </main>
  );
}
