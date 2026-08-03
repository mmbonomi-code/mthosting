import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioParametros from "./FormularioParametros";
import { guardarParametros } from "./acciones";

export default async function Parametros() {
  const supabase = await crearClienteServidor();

  const { data: parametros } = await supabase
    .from("parametros_operativos")
    .select("clave, valor, descripcion")
    .order("clave");

  const valores = Object.fromEntries(
    (parametros ?? []).map((p) => [p.clave, p.valor]),
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Parámetros operativos
        </h1>
        <p className="text-sm text-slate-400">
          Los horarios estándar de la operación. Si cambian, se ajustan acá sin
          tocar el sistema.
        </p>
      </div>
      <FormularioParametros accion={guardarParametros} valores={valores} />
    </main>
  );
}
