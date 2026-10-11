import { crearClienteServidor } from "@/lib/supabase/server";
import { clsTitulo } from "@/lib/ui";
import FormularioImportar from "./FormularioImportar";

/** Importar reseñas. Solo escritorio (CLAUDE.md: la importación no se optimiza para celular). */
export default async function ImportarResenas() {
  const supabase = await crearClienteServidor();
  const { data: deptos } = await supabase
    .from("departamentos")
    .select("id, codigo")
    .eq("activo", true)
    .is("airbnb_listing_id", null)
    .order("codigo");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className={clsTitulo}>Importar reseñas</h1>
        <p className="text-sm text-tinta-tenue">
          El Excel de reseñas de Airbnb. Primero se revisa qué va a pasar y recién al confirmar se
          guarda.
        </p>
      </div>

      <FormularioImportar deptos={deptos ?? []} />

      <div className="rounded-xl border border-borde bg-superficie p-4 text-sm text-tinta-tenue">
        <p className="mb-2 font-medium text-tinta-suave">Dos cosas que conviene saber</p>
        <p className="mb-1">
          <strong className="font-medium text-tinta-suave">Se puede subir las veces que haga falta.</strong>{" "}
          Cada reseña se reconoce por su número de Airbnb: subir dos veces lo mismo, o archivos que
          se pisan, no duplica nada. Una celda vacía nunca borra lo que ya estaba.
        </p>
        <p>
          <strong className="font-medium text-tinta-suave">El departamento sale del número del anuncio,</strong>{" "}
          no del nombre. Si cambia el título del anuncio en Airbnb, no pasa nada.
        </p>
      </div>
    </main>
  );
}
