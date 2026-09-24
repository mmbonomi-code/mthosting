import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { inicioDelRol, puedeEntrar, type Rol } from "@/lib/secciones";

/**
 * Guardián de sesión y de secciones.
 *
 * Refresca la cookie de Supabase, exige usuario autenticado en todas las
 * rutas —sin sesión solo se ve /ingresar— y corta las secciones que el rol no
 * puede abrir.
 *
 * El corte va acá y no en cada pantalla por una razón: es el único lugar por
 * el que pasan TODAS las direcciones, incluidas las que todavía no existen.
 * Una pantalla nueva queda cerrada sola, sin que nadie se acuerde de cerrarla.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          respuesta = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const ruta = request.nextUrl.pathname;
  const enIngresar = ruta.startsWith("/ingresar");

  if (!user && !enIngresar) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    return NextResponse.redirect(url);
  }

  // --- Con sesión: qué puede abrir según su rol ---
  const { rol, inactiva } = user
    ? await leerRol(supabase, user.id)
    : { rol: null, inactiva: false };

  // Dada de baja: afuera, aunque la sesión siga viva hasta que venza. "Sin
  // rol" no puede significar "sin restricción" para ella: esa excepción es
  // solo para el primer uso, cuando todavía no existe ninguna ficha.
  if (user && inactiva) {
    await supabase.auth.signOut();
    if (enIngresar) return respuesta;
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    url.search = "";
    const salida = NextResponse.redirect(url);
    // El cierre de sesión viaja en las cookies que dejó `setAll`.
    respuesta.cookies.getAll().forEach((c) => salida.cookies.set(c));
    return salida;
  }

  if (user && enIngresar) {
    const url = request.nextUrl.clone();
    url.pathname = inicioDelRol(rol);
    return NextResponse.redirect(url);
  }

  if (user && !puedeEntrar(rol, ruta)) {
    // A una llamada de datos se le contesta que no; redirigirla devolvería
    // una pantalla donde el que llama espera un archivo.
    if (ruta.startsWith("/api/")) {
      return new NextResponse("Tu rol no tiene acceso a esto.", { status: 403 });
    }
    const url = request.nextUrl.clone();
    url.pathname = inicioDelRol(rol);
    url.search = "";
    return NextResponse.redirect(url);
  }

  return respuesta;
}

/**
 * El rol de quien entra, y si su ficha está dada de baja.
 *
 * Si la consulta falla, o no hay ficha, se devuelve rol null, que es "sin
 * restricción": ante una caída de la base es preferible dejar pasar a dejar
 * a todo el equipo afuera. Lo que protege la plata y los datos de los
 * huéspedes no es esto, son las políticas de la base (que para quien no tiene
 * rol cierran todo) y los controles de cada acción.
 *
 * Una ficha que EXISTE y está inactiva es otra cosa: esa persona se va.
 */
async function leerRol(
  supabase: ReturnType<typeof createServerClient>,
  usuarioId: string,
): Promise<{ rol: Rol | null; inactiva: boolean }> {
  const { data } = await supabase
    .from("personas")
    .select("rol, activo")
    .eq("profile_id", usuarioId)
    .maybeSingle();

  if (!data) return { rol: null, inactiva: false };
  if (!data.activo) return { rol: null, inactiva: true };
  return { rol: (data.rol as Rol | null) ?? null, inactiva: false };
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.webmanifest).*)",
  ],
};
