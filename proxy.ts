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
  const rol = user ? await leerRol(supabase, user.id) : null;

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
 * El rol de quien entra. Una persona desactivada no tiene rol aunque lo tenga
 * escrito en la ficha, igual que en `lib/permisos.ts`.
 *
 * Si la consulta falla se devuelve null, que es "sin restricción": ante una
 * caída de la base es preferible dejar pasar a dejar a todo el equipo afuera.
 * Lo que protege la plata y los datos de los huéspedes no es esto, son las
 * políticas de la base y los controles de cada acción.
 */
async function leerRol(
  supabase: ReturnType<typeof createServerClient>,
  usuarioId: string,
): Promise<Rol | null> {
  const { data } = await supabase
    .from("personas")
    .select("rol, activo")
    .eq("profile_id", usuarioId)
    .maybeSingle();

  if (!data?.activo) return null;
  return (data.rol as Rol | null) ?? null;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.webmanifest).*)",
  ],
};
