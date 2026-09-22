"use client";

import { useActionState } from "react";
import { LogoHorizontal } from "@/app/componentes/Logo";
import { clsBoton, clsEntrada, clsTarjeta } from "@/lib/ui";
import { ingresar, type EstadoIngreso } from "./acciones";

/**
 * La pantalla de ingreso, con los mismos tokens que el resto de la app.
 *
 * Se entra desde el celular: nada tocable baja de 44px de alto.
 */
export default function PaginaIngresar() {
  const [estado, accion, pendiente] = useActionState<EstadoIngreso, FormData>(
    ingresar,
    null,
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-fondo px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <LogoHorizontal alto={30} className="text-tinta" />
          <p className="text-sm text-tinta-suave">Sistema de gestión</p>
        </div>

        <form
          action={accion}
          className={`mt-8 flex flex-col gap-5 p-6 ${clsTarjeta}`}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-tinta-suave">
              Email
            </span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              aria-invalid={estado?.error ? true : undefined}
              className={clsEntrada}
              placeholder="tu@email.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-tinta-suave">
              Contraseña
            </span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              aria-invalid={estado?.error ? true : undefined}
              className={clsEntrada}
            />
          </label>

          {estado?.error && (
            <p
              role="alert"
              className="rounded-lg bg-error-soft px-3 py-2.5 text-sm text-error-text"
            >
              {estado.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pendiente}
            className={`mt-1 ${clsBoton("primario", "grande")}`}
          >
            {pendiente ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-tinta-tenue">
          Si no tenés usuario, pedíselo a la administración.
        </p>
      </div>
    </main>
  );
}
