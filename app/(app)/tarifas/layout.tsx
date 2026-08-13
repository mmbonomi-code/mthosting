import { crearClienteServidor } from "@/lib/supabase/server";
import { esManagerOAdmin } from "@/lib/permisos";
import SinPermiso from "@/app/componentes/SinPermiso";

/**
 * Los valores de limpieza son lo que cobra cada persona: los ven manager y
 * administración (spec §3.8, decisión del dueño 12/08/2026).
 */
export default async function LayoutTarifas({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await crearClienteServidor();

  if (!(await esManagerOAdmin(supabase))) {
    return (
      <SinPermiso
        titulo="Valores"
        motivo="Los valores de limpieza los ven manager y administración. Si necesitás saber cuánto se paga una limpieza, preguntale a la manager."
      />
    );
  }

  return <>{children}</>;
}
