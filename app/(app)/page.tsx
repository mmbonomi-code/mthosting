import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
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

  if (!persona && totalPersonas === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center px-6">
        <form
          action={crearPrimerAdmin}
          className="flex w-full max-w-sm flex-col gap-4 text-center"
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
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Hola, {persona?.nombre ?? user?.email}
        </h1>
        <p className="text-sm text-slate-400">
          {persona?.rol ? NOMBRES_ROL[persona.rol] : "Sin rol asignado"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/departamentos"
          className="rounded-xl border border-slate-800 bg-slate-800/50 p-5 transition-colors hover:border-slate-600"
        >
          <h2 className="font-medium text-white">Departamentos</h2>
          <p className="mt-1 text-sm text-slate-400">
            Fichas, direcciones, wifi y accesos
          </p>
        </Link>
        <Link
          href="/propietarios"
          className="rounded-xl border border-slate-800 bg-slate-800/50 p-5 transition-colors hover:border-slate-600"
        >
          <h2 className="font-medium text-white">Propietarios</h2>
          <p className="mt-1 text-sm text-slate-400">
            Datos de contacto y acuerdos de pago
          </p>
        </Link>
      </div>

      <p className="text-xs text-slate-600">
        Fase 1 · Paso 2 — los módulos aparecen a medida que se construyen.
      </p>
    </main>
  );
}
