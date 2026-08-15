import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeGestionarReclamos } from "@/lib/reclamos/permisos";
import { contarReclamosUrgentes } from "@/lib/reclamos/alertas";
import { contarPendientesUrgentes } from "@/lib/reporte/alertas";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { esManagerOAdmin, rolDelUsuario } from "@/lib/permisos";
import { inicioDelRol, puedeEntrar } from "@/lib/secciones";
import { cerrarSesion } from "@/app/ingresar/acciones";
import { LogoHorizontal } from "@/app/componentes/Logo";
import { clsBoton } from "@/app/componentes/Boton";
import Navegacion, { type ItemMenu } from "./Navegacion";

export default async function LayoutApp({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    { data: persona },
    { count: sinAsignar },
    verReclamos,
    verCaja,
    esConfiguracion,
    rol,
  ] = await Promise.all([
    supabase
      .from("personas")
      .select("nombre")
      .eq("profile_id", user!.id)
      .maybeSingle(),
    supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .is("depto_id", null)
      .eq("descartada", false),
    puedeGestionarReclamos(supabase),
    puedeVerCaja(supabase),
    esManagerOAdmin(supabase),
    rolDelUsuario(supabase),
  ]);

  // El menú avisa cuántas cosas hay que mirar hoy, sin entrar a la pantalla.
  // No se cuenta lo que este rol no va a ver.
  const [reclamosUrgentes, reporteUrgente] = await Promise.all([
    verReclamos ? contarReclamosUrgentes(supabase) : Promise.resolve(0),
    puedeEntrar(rol, "/reporte")
      ? contarPendientesUrgentes(supabase)
      : Promise.resolve(0),
  ]);

  const items: ItemMenu[] = [
    { href: "/", texto: "Inicio", pendientes: 0 },
    { href: "/dia", texto: "Día", pendientes: 0 },
    { href: "/dashboard", texto: "Dashboard", pendientes: 0 },
    { href: "/reporte", texto: "Reporte", pendientes: reporteUrgente },
    ...(verCaja ? [{ href: "/caja", texto: "Caja", pendientes: 0 }] : []),
    ...(verReclamos
      ? [{ href: "/reclamos", texto: "Reclamos", pendientes: reclamosUrgentes }]
      : []),
    { href: "/semana", texto: "Limpiezas", pendientes: 0 },
    { href: "/departamentos", texto: "Departamentos", pendientes: 0 },
    { href: "/propietarios", texto: "Propietarios", pendientes: 0 },
    // Configuración del sistema: manager y administración (spec §3.8).
    ...(esConfiguracion
      ? [
          { href: "/personas", texto: "Personas", pendientes: 0 },
          { href: "/tarifas", texto: "Valores", pendientes: 0 },
        ]
      : []),
    { href: "/puntos-acceso", texto: "Accesos", pendientes: 0 },
    { href: "/parametros", texto: "Parámetros", pendientes: 0 },
    { href: "/importar", texto: "Importar", pendientes: 0 },
    { href: "/exportar", texto: "Exportar", pendientes: 0 },
    { href: "/ical", texto: "Calendarios", pendientes: 0 },
    { href: "/bandeja", texto: "Sin asignar", pendientes: sinAsignar ?? 0 },
    // El menú ofrece exactamente lo que el guardián deja abrir. Es la misma
    // función en los dos lados: si se separan, aparecen enlaces que rebotan.
  ].filter((item) => puedeEntrar(rol, item.href));

  return (
    <div className="flex min-h-full flex-1 flex-col bg-fondo">
      <header className="sticky top-0 z-10 border-b border-borde bg-superficie/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Al logo lo lleva a su pantalla de entrada, que no es la misma
              para todos los roles. */}
          <Link href={inicioDelRol(rol)} className="shrink-0">
            <LogoHorizontal alto={26} tono="color" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-tinta-suave sm:block">
              {persona?.nombre ?? user?.email}
            </span>
            <form action={cerrarSesion}>
              <button type="submit" className={clsBoton("discreto")}>
                Salir
              </button>
            </form>
          </div>
        </div>
        <Navegacion items={items} />
      </header>
      {children}
    </div>
  );
}
