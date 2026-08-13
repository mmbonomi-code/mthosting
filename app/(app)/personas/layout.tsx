import { crearClienteServidor } from "@/lib/supabase/server";
import { esManagerOAdmin } from "@/lib/permisos";
import SinPermiso from "@/app/componentes/SinPermiso";

/**
 * Personas es configuración del sistema: la ven manager y administración
 * (spec §3.8, decisión del dueño 12/08/2026). Dar acceso a la app y
 * reiniciar contraseñas sigue siendo solo de administración, adentro.
 *
 * La puerta va en el layout para que el alta y la edición queden cubiertas
 * sin repetir el control en cada una.
 */
export default async function LayoutPersonas({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await crearClienteServidor();

  if (!(await esManagerOAdmin(supabase))) {
    return (
      <SinPermiso
        titulo="Personas"
        motivo="Esta pantalla es de manager y administración. Si necesitás cambiar los datos de alguien, pedíselo a la manager."
      />
    );
  }

  return <>{children}</>;
}
