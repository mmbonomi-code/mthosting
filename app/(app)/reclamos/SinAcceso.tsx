/**
 * Los reclamos los ven back office, manager y administración. A los demás
 * se les dice que no tienen acceso, en vez de mostrarles una lista vacía que
 * parece un error del sistema.
 */
export default function SinAcceso() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Reclamos</h1>
      <p className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-8 text-slate-300">
        Esta pantalla es de back office, manager y administración. Si necesitás
        entrar, pedíselo a administración.
      </p>
    </main>
  );
}
