"use client";

import { useActionState } from "react";
import type { EstadoClave } from "../../acciones";
import { clsEntrada, clsEtiqueta } from "@/lib/ui";

/**
 * Contraseña nueva para alguien que ya tiene usuario. No hay mail de
 * recuperación: administración le pone una y se la pasa.
 */
export default function FormularioClave({
  accion,
}: {
  accion: (estadoPrevio: EstadoClave, fd: FormData) => Promise<EstadoClave>;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoClave, FormData>(accion, null);

  return (
    <form action={enviar} className="flex flex-col gap-3 border-t border-borde pt-3">
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Contraseña nueva</span>
        <div className="flex flex-wrap gap-2">
          <input
            type="text"
            name="password"
            required
            minLength={8}
            autoComplete="off"
            placeholder="Mínimo 8 caracteres"
            className={`${clsEntrada} min-w-48 flex-1`}
          />
          <button
            type="submit"
            disabled={pendiente}
            className="h-11 shrink-0 rounded-md border border-borde-control px-4 text-sm text-tinta transition-colors hover:bg-superficie-alt disabled:opacity-60"
          >
            {pendiente ? "Cambiando…" : "Reiniciar contraseña"}
          </button>
        </div>
      </label>

      <p className="text-xs text-tinta-tenue">
        Se ve mientras la escribís para que puedas copiarla y pasársela. La
        anterior deja de funcionar en el momento.
      </p>

      {estado && "error" in estado && (
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-md bg-exito-soft px-3 py-2 text-sm text-exito-text">
          ✓ {estado.ok}
        </p>
      )}
    </form>
  );
}
