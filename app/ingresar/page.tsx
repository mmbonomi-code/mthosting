"use client";

import { useActionState } from "react";
import { LogoHorizontal } from "@/app/componentes/Logo";
import { ingresar, type EstadoIngreso } from "./acciones";

/**
 * Primera pantalla con la identidad aplicada (docs/IDENTIDAD-VISUAL.md).
 *
 * Es la más simple de la app y no comparte nada con el resto, así que sirve
 * de cabeza de playa: los tokens y la tipografía se prueban acá antes de
 * tocar las pantallas de trabajo.
 *
 * Se entra desde el celular: los campos y el botón van a 48px de alto, por
 * encima del mínimo de 44 que fija la identidad para cualquier cosa tocable.
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
          <LogoHorizontal alto={30} />
          <p className="text-sm text-tinta-suave">Sistema de gestión</p>
        </div>

        <form
          action={accion}
          className="mt-8 flex flex-col gap-5 rounded-md border border-borde bg-superficie p-6 shadow-sm"
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
              className="h-12 rounded-sm border border-borde-control bg-superficie px-3 text-base text-tinta outline-none placeholder:text-tinta-tenue focus:border-primary aria-invalid:border-error"
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
              className="h-12 rounded-sm border border-borde-control bg-superficie px-3 text-base text-tinta outline-none focus:border-primary aria-invalid:border-error"
            />
          </label>

          {estado?.error && (
            <p
              role="alert"
              className="rounded-sm bg-error-soft px-3 py-2.5 text-sm text-error-text"
            >
              {estado.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pendiente}
            className="mt-1 h-12 rounded-sm bg-primary text-base font-semibold text-tinta-inversa transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active disabled:cursor-not-allowed disabled:opacity-45"
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
