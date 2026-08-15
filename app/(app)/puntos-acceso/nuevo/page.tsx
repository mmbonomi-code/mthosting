import FormularioPuntoAcceso from "../FormularioPuntoAcceso";
import { crearPuntoAcceso } from "../acciones";

export default function NuevoPuntoAcceso() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">
        Nuevo punto de acceso
      </h1>
      <FormularioPuntoAcceso accion={crearPuntoAcceso} urlCancelar="/puntos-acceso" />
    </main>
  );
}
