import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerEconomico } from "@/lib/economico/permisos";
import SinPermiso from "@/app/componentes/SinPermiso";

/**
 * La sección ECONÓMICO: toda la información financiera del negocio.
 *
 * La puerta va acá y no en cada página, así una pantalla nueva no se puede
 * olvidar de pedir el permiso. Igual las acciones controlan por su cuenta: un
 * layout protege lo que se ve, no lo que se ejecuta.
 */
export default async function LayoutEconomico({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await crearClienteServidor();

  if (!(await puedeVerEconomico(supabase))) {
    return (
      <SinPermiso
        titulo="Económico"
        motivo="La información económica la ven manager y administración. Acá están los ingresos por departamento y los datos de los huéspedes."
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex gap-1 overflow-x-auto border-b border-slate-800 px-4 py-2 sm:px-6">
        {[
          { href: "/economico", texto: "Resumen" },
          { href: "/economico/importar", texto: "Importar" },
          { href: "/economico/anuncios", texto: "Anuncios sin mapear" },
          { href: "/economico/cuentas", texto: "Cuentas de payout" },
          { href: "/economico/importaciones", texto: "Importaciones" },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            {item.texto}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
