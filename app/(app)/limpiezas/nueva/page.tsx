import { crearClienteServidor } from "@/lib/supabase/server";
import { hoyAR } from "@/lib/fechas";
import FormularioNuevaLimpieza from "./FormularioNuevaLimpieza";
import { crearLimpieza } from "../acciones";

export default async function NuevaLimpieza() {
  const supabase = await crearClienteServidor();

  const { data: departamentos } = await supabase
    .from("departamentos")
    .select("id, codigo, nombre_interno")
    .eq("activo", true)
    .order("codigo");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Nueva limpieza
        </h1>
        <p className="text-sm text-tinta-suave">
          Para lo que no genera el importador: cambios de blancos, limpiezas
          con huéspedes adentro, iniciales, desmantelar o visitas del
          propietario.
        </p>
      </div>
      <FormularioNuevaLimpieza
        accion={crearLimpieza}
        departamentos={departamentos ?? []}
        fechaPorDefecto={hoyAR()}
      />
    </main>
  );
}
