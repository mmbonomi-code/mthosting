import FormularioPropietario from "../FormularioPropietario";
import { crearPropietario } from "../acciones";

export default function NuevoPropietario() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Nuevo propietario
      </h1>
      <FormularioPropietario
        accion={crearPropietario}
        urlCancelar="/propietarios"
      />
    </main>
  );
}
