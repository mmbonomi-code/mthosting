import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { cajaDesbloqueada } from "@/lib/caja/codigo";
import { desbloquearCaja } from "./acciones";
import PedirCodigo from "./PedirCodigo";
import SinAcceso from "./SinAcceso";

/**
 * La puerta de la caja, para todas sus pantallas de una vez.
 *
 * Primero el permiso —manager o administración— y después el código, que es
 * una cortina para que la plata no aparezca de entrada en una pantalla que
 * puede estar a la vista. Ponerlo acá y no en cada página evita que una
 * pantalla nueva se olvide de pedirlo.
 */
export default async function LayoutCaja({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCaja(supabase))) return <SinAcceso />;

  if (!(await cajaDesbloqueada())) {
    return (
      <PedirCodigo
        accion={async (_previo, fd) => {
          "use server";
          return desbloquearCaja(fd);
        }}
      />
    );
  }

  return <>{children}</>;
}
