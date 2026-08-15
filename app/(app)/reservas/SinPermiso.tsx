/**
 * Cargar y editar reservas es de coordinación, manager y administración
 * (§2.10.bis, ampliado el 14/08/2026). A los demás se les dice por qué, en vez
 * de esconder el botón sin explicación.
 */
export default function SinPermiso() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-tinta">Reservas</h1>
      <p className="rounded-md border border-borde bg-superficie px-6 py-8 text-tinta-suave">
        Cargar y editar reservas es de coordinación, manager y administración.
        Una fecha mal escrita mueve limpiezas y deja gente esperando en la
        puerta, así que si necesitás cambiar algo, pedíselo a alguno de ellos.
      </p>
    </main>
  );
}
