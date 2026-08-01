import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cerrarSesion } from "@/app/ingresar/acciones";

export default async function LayoutApp({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: persona } = await supabase
    .from("personas")
    .select("nombre")
    .eq("profile_id", user!.id)
    .maybeSingle();

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0">
            <span className="text-lg font-semibold tracking-tight text-white">
              MTHosting
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:block">
              {persona?.nombre ?? user?.email}
            </span>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 sm:px-4">
          {[
            { href: "/", texto: "Inicio" },
            { href: "/departamentos", texto: "Departamentos" },
            { href: "/propietarios", texto: "Propietarios" },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              {item.texto}
            </Link>
          ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
