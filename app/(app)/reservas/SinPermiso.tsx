/**
 * Los datos que llegan de Airbnb los edita manager o administración (§2.10.bis).
 * A los demás se les dice por qué, en vez de esconder el botón sin explicación.
 */
export default function SinPermiso() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Reservas</h1>
      <p className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-8 text-slate-300">
        Cargar y editar reservas es de manager y administración. Una fecha mal
        escrita mueve limpiezas y deja gente esperando en la puerta, así que si
        necesitás cambiar algo, pedíselo a la manager.
      </p>
    </main>
  );
}
