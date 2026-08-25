import FormularioPeriodica from "../../FormularioPeriodica";
import { crearTareaPeriodica } from "../../acciones";

export default function NuevaTareaPeriodica() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Nueva tarea periódica</h1>
      <FormularioPeriodica accion={crearTareaPeriodica} />
    </main>
  );
}
