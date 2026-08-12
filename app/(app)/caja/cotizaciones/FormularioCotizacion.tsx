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
      className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4"
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
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          ✓ {estado.ok}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
