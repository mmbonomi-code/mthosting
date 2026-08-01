import { crearClienteServidor } from "@/lib/supabase/server";
import { cerrarSesion } from "./ingresar/acciones";
import { crearPrimerAdmin } from "./acciones";

const NOMBRES_ROL: Record<string, string> = {
  admin: "Administración",
  manager: "Manager",
  gobernanta: "Gobernanta",
  coordinador: "Coordinación",
  limpieza: "Limpieza",
  propietario: "Propietario",
};

export default async function Inicio() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: persona } = await supabase
    .from("personas")
    .select("nombre, rol")
    .eq("profile_id", user!.id)
    .maybeSingle();

  const { count: totalPersonas } = await supabase
    .from("personas")
    .select("id", { count: "exact", head: true });

  return (
    <main className="flex flex-1 flex-col bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">
            MTHosting
          </h1>
          <p className="text-sm text-slate-400">
            {persona
              ? `${persona.nombre} · ${persona.rol ? NOMBRES_ROL[persona.rol] : "Sin rol"}`
              : user?.email}
          </p>
        </div>
        <form action={cerrarSesion}>
          <button
            type="submit"
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
          >
            Salir
          </button>
        </form>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        {!persona && totalPersonas === 0 ? (
          <form
            action={crearPrimerAdmin}
            className="flex w-full max-w-sm flex-col gap-4"
          >
            <h2 className="text-lg font-medium text-white">
              Primer uso del sistema
            </h2>
            <p className="text-sm text-slate-400">
              Todavía no hay personas cargadas. Creá tu ficha de administración
              para empezar.
            </p>
            <input
              type="text"
              name="nombre"
              required
              placeholder="Tu nombre"
              className="h-12 rounded-lg border border-slate-700 bg-slate-800 px-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-slate-400"
            />
            <button
              type="submit"
              className="h-12 rounded-lg bg-white text-base font-semibold text-slate-900 transition-colors hover:bg-slate-200"
            >
              Crear mi ficha de admin
            </button>
          </form>
        ) : (
          <>
            <p className="text-lg text-slate-300">
              Sesión iniciada correctamente.
            </p>
            <p className="text-sm text-slate-500">
              Fase 1 · Paso 1: acceso funcionando. Los módulos aparecen acá a
              medida que se construyen.
            </p>
          </>
        )}
      </section>
    </main>
  );
}
