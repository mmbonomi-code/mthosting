import { crearClienteServidor } from "@/lib/supabase/server";
import { esManagerOAdmin } from "@/lib/permisos";
import SinPermiso from "@/app/componentes/SinPermiso";

/**
 * Qué hay en el checklist de cada limpieza y cada cuánto se hacen las tareas
 * periódicas (vidrios, colchones...) lo definen manager y administración
 * (mismo criterio que valores de limpieza y personas).
 */
export default async function LayoutChecklistLimpieza({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await crearClienteServidor();

  if (!(await esManagerOAdmin(supabase))) {
    return (
      <SinPermiso
        titulo="Checklist de limpieza"
        motivo="Qué se revisa en cada limpieza lo configuran manager y administración."
      />
    );
  }

  return <>{children}</>;
}
