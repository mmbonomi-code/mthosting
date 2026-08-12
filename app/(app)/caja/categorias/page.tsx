import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { alternarCategoria, crearCategoria } from "../acciones";
import NuevaCategoria from "./NuevaCategoria";
import SinAcceso from "../SinAcceso";

export default async function Categorias() {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCaja(supabase))) return <SinAcceso />;

  const { data: categorias } = await supabase
    .from("categorias_movimiento")
    .select("id, nombre, activo")
    .order("nombre");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/caja" className="text-sm text-slate-400 hover:text-white">
        ← Volver a la caja
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Categorías</h1>
        <p className="text-sm text-slate-400">
          Una categoría desactivada deja de ofrecerse al cargar, pero los
          movimientos que ya la usan la conservan.
        </p>
      </div>

      <NuevaCategoria
        accion={async (_previo, fd) => {
          "use server";
          return crearCategoria(fd);
        }}
      />

      <ul className="flex flex-col gap-1.5">
        {(categorias ?? []).map((c) => (
          <li
            key={c.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-4 py-2.5"
          >
            <span className={c.activo ? "text-slate-100" : "text-slate-500 line-through"}>
              {c.nombre}
            </span>
            <form action={alternarCategoria.bind(null, c.id, !c.activo)}>
              <button
                type="submit"
                className="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-300 hover:bg-slate-800"
              >
                {c.activo ? "Desactivar" : "Activar"}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </main>
  );
}
