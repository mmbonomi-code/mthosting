import { clsBoton } from "@/lib/ui";
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
          <p className="text-sm text-tinta-tenue">
            Todavía no hay personas cargadas. Creá tu ficha de administración
            para empezar.
          </p>
          <input
            type="text"
            name="nombre"
            required
            placeholder="Tu nombre"
            className="h-12 rounded-lg border border-borde-control bg-elevada px-4 text-base text-tinta outline-none placeholder:text-tinta-etiqueta focus:border-primary"
          />
          <button
            type="submit"
            className={clsBoton("primario", "grande")}
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
        <p className="text-sm text-tinta-tenue">
          {persona?.rol ? NOMBRES_ROL[persona.rol] : "Sin rol asignado"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/departamentos"
          className="rounded-xl border border-borde bg-elevada/50 p-5 transition-colors hover:border-borde-fuerte"
        >
          <h2 className="font-medium text-tinta">Departamentos</h2>
          <p className="mt-1 text-sm text-tinta-tenue">
            Fichas, direcciones, wifi y accesos
          </p>
        </Link>
        <Link
          href="/propietarios"
          className="rounded-xl border border-borde bg-elevada/50 p-5 transition-colors hover:border-borde-fuerte"
        >
          <h2 className="font-medium text-tinta">Propietarios</h2>
          <p className="mt-1 text-sm text-tinta-tenue">
            Datos de contacto y acuerdos de pago
          </p>
        </Link>
      </div>

      <p className="text-xs text-tinta-apagada">
        Fase 1 · Paso 2 — los módulos aparecen a medida que se construyen.
      </p>
    </main>
  );
}
