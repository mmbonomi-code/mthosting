import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeGestionarReclamos } from "@/lib/reclamos/permisos";
import { contarReclamosUrgentes } from "@/lib/reclamos/alertas";
import { contarPendientesUrgentes } from "@/lib/reporte/alertas";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { puedeVerEconomico } from "@/lib/economico/permisos";
import { rolPuedeVerAlertas } from "@/lib/alertas/permisos";
import { rolPuedeVerMisLimpiezas } from "@/lib/limpiezas/permisos";
import { calcularPanelAlertas, contarCriticas, contarResto } from "@/lib/alertas/consultar";
import { esManagerOAdmin, rolDelUsuario } from "@/lib/permisos";
import { inicioDelRol, puedeEntrar } from "@/lib/secciones";
import { cerrarSesion } from "@/app/ingresar/acciones";

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
    verEconomico,
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
    puedeVerEconomico(supabase),
    esManagerOAdmin(supabase),
    rolDelUsuario(supabase),
  ]);

  // Pura: no hace falta otra consulta a personas para decidir si se muestra
  // el link.
  const verAlertas = rolPuedeVerAlertas(rol);
  const verMisLimpiezas = rolPuedeVerMisLimpiezas(rol);

  // El menú avisa cuántas cosas hay que mirar hoy, sin entrar a la pantalla.
  // No se cuenta lo que este rol no va a ver.
  const [reclamosUrgentes, reporteUrgente, panelAlertas] = await Promise.all([
    verReclamos ? contarReclamosUrgentes(supabase) : Promise.resolve(0),
    puedeEntrar(rol, "/reporte")
      ? contarPendientesUrgentes(supabase)
      : Promise.resolve(0),
    verAlertas ? calcularPanelAlertas(supabase) : Promise.resolve(null),
  ]);
  const alertasCriticas = panelAlertas ? contarCriticas(panelAlertas) : 0;
  const alertasResto = panelAlertas ? contarResto(panelAlertas) : 0;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-slate-900">
      <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
          {/* Al nombre lo lleva a su pantalla de entrada, que no es la misma
              para todos los roles. */}
          <Link href={inicioDelRol(rol)} className="shrink-0">
            <span className="text-lg font-semibold tracking-tight text-white">
              MTHosting
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-400 sm:block">
              {persona?.nombre ?? user?.email}
            </span>
            <form action={cerrarSesion}>
              <button
                type="submit"
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-2 sm:px-4">
          {[
            { href: "/", texto: "Inicio", pendientes: 0 },
            { href: "/dia", texto: "Día", pendientes: 0 },
            { href: "/dashboard", texto: "Dashboard", pendientes: 0 },
            { href: "/reporte", texto: "Reporte", pendientes: reporteUrgente },
            ...(verAlertas
              ? [
                  {
                    href: "/alertas",
                    texto: "Alertas",
                    pendientes: alertasResto,
                    criticas: alertasCriticas,
                  },
                ]
              : []),
            ...(verCaja ? [{ href: "/caja", texto: "Caja", pendientes: 0 }] : []),
            // Económico es SOLO de administración (decisión del dueño,
            // 16/08/2026). Se usa su propio permiso y no el de configuración:
            // ofrecerle el enlace a un manager lo mandaría a un cartel de "no
            // tenés acceso", que es peor que no verlo.
            ...(verEconomico
              ? [{ href: "/economico", texto: "Económico", pendientes: 0 }]
              : []),
            ...(verReclamos
              ? [{ href: "/reclamos", texto: "Reclamos", pendientes: reclamosUrgentes }]
              : []),
            ...(verMisLimpiezas
              ? [{ href: "/mis-limpiezas", texto: "Mis limpiezas", pendientes: 0 }]
              : []),
            { href: "/semana", texto: "Limpiezas", pendientes: 0 },
            { href: "/departamentos", texto: "Departamentos", pendientes: 0 },
            { href: "/propietarios", texto: "Propietarios", pendientes: 0 },
            // Configuración del sistema: manager y administración (spec §3.8).
            ...(esConfiguracion
              ? [
                  { href: "/personas", texto: "Personas", pendientes: 0 },
                  { href: "/tarifas", texto: "Valores", pendientes: 0 },
                  { href: "/checklist-limpieza", texto: "Checklist limpieza", pendientes: 0 },
                ]
              : []),
            { href: "/puntos-acceso", texto: "Accesos", pendientes: 0 },
            { href: "/parametros", texto: "Parámetros", pendientes: 0 },
            { href: "/importar", texto: "Importar", pendientes: 0 },
            { href: "/exportar", texto: "Exportar", pendientes: 0 },
            { href: "/ical", texto: "Calendarios", pendientes: 0 },
            { href: "/bandeja", texto: "Sin asignar", pendientes: sinAsignar ?? 0 },
          ]
            // El menú ofrece exactamente lo que el guardián deja abrir. Es la
            // misma función en los dos lados: si se separan, aparecen enlaces
            // que rebotan.
            .filter((item) => puedeEntrar(rol, item.href))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                {item.texto}
                {"criticas" in item && (item.criticas ?? 0) > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-xs font-semibold text-red-950">
                    {item.criticas}
                  </span>
                )}
                {item.pendientes > 0 && (
                  <span className="rounded-full bg-amber-500 px-1.5 text-xs font-semibold text-slate-900">
                    {item.pendientes}
                  </span>
                )}
              </Link>
            ))}
        </nav>
      </header>
      {children}
    </div>
  );
}
