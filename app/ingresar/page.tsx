"use client";

import { useActionState } from "react";
import { ingresar, type EstadoIngreso } from "./acciones";

export default function PaginaIngresar() {
  const [estado, accion, pendiente] = useActionState<EstadoIngreso, FormData>(
    ingresar,
    null,
  );

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-slate-900 px-6">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-white">
          MTHosting
        </h1>
        <p className="mt-1 text-center text-sm text-slate-400">
          Sistema de gestión
        </p>

        <form action={accion} className="mt-8 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">Email</span>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              autoFocus
              className="h-12 rounded-lg border border-slate-700 bg-slate-800 px-4 text-base text-white outline-none placeholder:text-slate-500 focus:border-slate-400"
              placeholder="tu@email.com"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">
              Contraseña
            </span>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="h-12 rounded-lg border border-slate-700 bg-slate-800 px-4 text-base text-white outline-none focus:border-slate-400"
            />
          </label>

          {estado?.error && (
            <p
              role="alert"
              className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300"
            >
              {estado.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pendiente}
            className="mt-2 h-12 rounded-lg bg-white text-base font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
          >
            {pendiente ? "Ingresando…" : "Ingresar"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Si no tenés usuario, pedíselo a la administración.
        </p>
      </div>
    </main>
  );
}
