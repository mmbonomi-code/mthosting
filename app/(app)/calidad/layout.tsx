import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCalidad } from "@/lib/calidad/permisos";
import SinPermiso from "@/app/componentes/SinPermiso";

/**
 * La sección CALIDAD: reseñas de Airbnb (docs/CALIDAD-ESPECIFICACION.md).
 *
 * La puerta va acá y no en cada página, así una pantalla nueva no se puede
 * olvidar de pedir el permiso. Las acciones controlan igual por su cuenta, y
 * la base tiene la última palabra (`puede_ver_calidad()`).
 */
export default async function LayoutCalidad({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await crearClienteServidor();

  if (!(await puedeVerCalidad(supabase))) {
    return (
      <SinPermiso
        titulo="Calidad"
        motivo="Las reseñas las ven manager y administración. Hay comentarios privados de los huéspedes y el ranking del personal de limpieza."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex gap-1 overflow-x-auto border-b border-borde px-4 py-2 sm:px-6">
        {[
          { href: "/calidad", texto: "Resumen" },
          { href: "/calidad/limpieza", texto: "Ranking de limpieza" },
          { href: "/calidad/importar", texto: "Importar" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-tinta-tenue transition-colors hover:bg-elevada hover:text-tinta"
          >
            {item.texto}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
