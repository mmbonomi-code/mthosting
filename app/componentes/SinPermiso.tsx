/**
 * Pantalla para quien no tiene permiso.
 *
 * Se dice el motivo en vez de mostrar una lista vacía: una pantalla sin nada
 * parece un error del sistema y la gente la reporta como si lo fuera.
 */
export default function SinPermiso({
  titulo,
  motivo,
}: {
  titulo: string;
  motivo: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">{titulo}</h1>
      <p className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-8 text-slate-300">
        {motivo}
      </p>
    </main>
  );
}
