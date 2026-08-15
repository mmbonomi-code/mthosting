"use client";

import { useActionState } from "react";
import { clsEntrada, clsEtiqueta } from "@/lib/ui";
import type { EstadoFormulario } from "@/lib/caja/tipos";

export default function FormularioCotizacion({
  hoy,
  accion,
}: {
  hoy: string;
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form
      action={enviar}
      className="flex flex-col gap-3 rounded-md border border-borde-control bg-superficie p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Fecha</span>
          <input
            type="date"
            name="fecha"
            defaultValue={hoy}
            required
            className={clsEntrada}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Cotización</span>
          <input
            type="text"
            inputMode="decimal"
            name="tc"
            required
            placeholder="1445"
            className={clsEntrada}
          />
        </label>
      </div>

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

      <div>
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-tinta-inversa hover:bg-primary-hover disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
