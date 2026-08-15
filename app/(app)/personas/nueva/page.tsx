import FormularioPersona from "../FormularioPersona";
import { crearPersona } from "../acciones";

export default function NuevaPersona() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">
        Nueva persona
      </h1>
      <FormularioPersona accion={crearPersona} urlCancelar="/personas" />
    </main>
  );
}
