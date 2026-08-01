import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Guardián de sesión: refresca la cookie de Supabase y exige usuario
 * autenticado en todas las rutas. Sin sesión solo se puede ver /ingresar.
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

  const enIngresar = request.nextUrl.pathname.startsWith("/ingresar");

  if (!user && !enIngresar) {
    const url = request.nextUrl.clone();
    url.pathname = "/ingresar";
    return NextResponse.redirect(url);
  }

  if (user && enIngresar) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|manifest\\.webmanifest).*)",
  ],
};
