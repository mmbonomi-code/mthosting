/**
 * La caja es de manager y administración. A los demás se les dice por qué,
 * en vez de mostrarles una pantalla vacía que parece un error.
 */
export default function SinAcceso() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">Caja</h1>
      <p className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-8 text-slate-300">
        La caja la ven la manager y administración. Si necesitás entrar,
        pedíselo a administración.
      </p>
    </main>
  );
}
