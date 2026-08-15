/**
 * La caja es de manager y administración. A los demás se les dice por qué,
 * en vez de mostrarles una pantalla vacía que parece un error.
 */
export default function SinAcceso() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">Caja</h1>
      <p className="rounded-md border border-borde bg-superficie px-6 py-8 text-tinta-suave">
        La caja la ven la manager y administración. Si necesitás entrar,
        pedíselo a administración.
      </p>
    </main>
  );
}
