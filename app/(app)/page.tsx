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
          <h2 className="text-lg font-medium text-tinta">
            Primer uso del sistema
          </h2>
          <p className="text-sm text-tinta-suave">
            Todavía no hay personas cargadas. Creá tu ficha de administración
            para empezar.
          </p>
          <input
            type="text"
            name="nombre"
            required
            placeholder="Tu nombre"
            className="h-12 rounded-md border border-borde-control bg-superficie-alt px-4 text-base text-tinta outline-none placeholder:text-tinta-tenue focus:border-primary"
          />
          <button
            type="submit"
            className="h-12 rounded-md bg-primary text-base font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover"
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
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Hola, {persona?.nombre ?? user?.email}
        </h1>
        <p className="text-sm text-tinta-suave">
          {persona?.rol ? NOMBRES_ROL[persona.rol] : "Sin rol asignado"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/departamentos"
          className="rounded-md border border-borde bg-superficie p-5 transition-colors hover:border-borde-fuerte"
        >
          <h2 className="font-medium text-tinta">Departamentos</h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Fichas, direcciones, wifi y accesos
          </p>
        </Link>
        <Link
          href="/propietarios"
          className="rounded-md border border-borde bg-superficie p-5 transition-colors hover:border-borde-fuerte"
        >
          <h2 className="font-medium text-tinta">Propietarios</h2>
          <p className="mt-1 text-sm text-tinta-suave">
            Datos de contacto y acuerdos de pago
          </p>
        </Link>
      </div>

      <p className="text-xs text-tinta-tenue">
        Fase 1 · Paso 2 — los módulos aparecen a medida que se construyen.
      </p>
    </main>
  );
}
