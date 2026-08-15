"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../tarifas/acciones";
import { clsEntrada } from "@/lib/ui";

export default function FormularioFeriado({
  accion,
  hoy,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  hoy: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="date"
          name="fecha"
          required
          defaultValue={hoy}
          className={`${clsEntrada} sm:w-48`}
        />
        <input
          name="descripcion"
          placeholder="Descripción (ej.: Día de la Independencia)"
          className={clsEntrada}
        />
        <button
          type="submit"
          disabled={pendiente}
          className="h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pendiente ? "Agregando…" : "Agregar"}
        </button>
      </div>
      {estado?.error && (
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
          {estado.error}
        </p>
      )}
    </form>
  );
}
