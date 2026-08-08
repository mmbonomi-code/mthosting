import { notFound } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import FormularioPersona from "../../FormularioPersona";
import FormularioAcceso from "./FormularioAcceso";
import FormularioClave from "./FormularioClave";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import {
  actualizarPersona,
  darAcceso,
  quitarAcceso,
  reiniciarClave,
} from "../../acciones";

export default async function EditarPersona({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const { data: persona } = await supabase
    .from("personas")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!persona) notFound();

  // Solo administración crea usuarios (spec §3.8).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: yo } = await supabase
    .from("personas")
    .select("rol")
    .eq("profile_id", user!.id)
    .maybeSingle();
  const puedeGestionarAcceso = yo?.rol === "admin";

  // Con qué email entra: administración lo necesita para pasárselo junto con
  // la contraseña nueva, y nadie se acuerda cuál cargó.
  let emailUsuario: string | null = null;
  if (puedeGestionarAcceso && persona.profile_id) {
    const admin = crearClienteAdmin();
    if (admin) {
      const { data } = await admin.auth.admin.getUserById(persona.profile_id);
      emailUsuario = data.user?.email ?? null;
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight text-white">
        {persona.nombre}
      </h1>

      <FormularioPersona
        accion={actualizarPersona.bind(null, id)}
        valores={persona}
        urlCancelar="/personas"
      />

      {puedeGestionarAcceso && (
        <section className="flex flex-col gap-3 rounded-xl border border-slate-800 p-4">
          <div>
            <h2 className="font-medium text-white">Acceso al sistema</h2>
            <p className="text-sm text-slate-400">
              Las limpiadoras y la gobernanta necesitan usuario para entrar a la
              app desde el celular.
            </p>
          </div>

          {persona.profile_id ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-emerald-300">
                  ✓ Entra a la app
                  {emailUsuario && (
                    <span className="text-slate-400"> con {emailUsuario}</span>
                  )}
                </p>
                <form action={quitarAcceso.bind(null, id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    Quitar acceso
                  </button>
                </form>
              </div>
              <FormularioClave accion={reiniciarClave.bind(null, id)} />
            </>
          ) : (
            <FormularioAcceso accion={darAcceso.bind(null, id)} />
          )}
        </section>
      )}
    </main>
  );
}
