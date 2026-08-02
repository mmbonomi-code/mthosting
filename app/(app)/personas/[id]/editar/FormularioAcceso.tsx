"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../../acciones";
import { clsEntrada, clsEtiqueta } from "@/lib/ui";

export default function FormularioAcceso({
  accion,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Email</span>
          <input
            type="email"
            name="email"
            required
            autoComplete="off"
            placeholder="persona@email.com"
            className={clsEntrada}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Contraseña inicial</span>
          <input
            type="text"
            name="password"
            required
            minLength={8}
            autoComplete="off"
            placeholder="Mínimo 8 caracteres"
            className={clsEntrada}
          />
        </label>
      </div>

      <p className="text-xs text-slate-500">
        Pasale estos datos a la persona. Con ellos entra a la app desde su
        celular.
      </p>

      {estado?.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pendiente}
          className="h-11 rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Creando…" : "Crear usuario"}
        </button>
      </div>
    </form>
  );
}
