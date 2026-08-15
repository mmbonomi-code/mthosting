"use client";

import { useActionState, useEffect, useRef } from "react";
import { clsEntrada } from "@/lib/ui";
import type { EstadoFormulario } from "@/lib/caja/tipos";

export default function NuevaCategoria({
  accion,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  useEffect(() => {
    if (estado && "ok" in estado) formRef.current?.reset();
  }, [estado]);

  return (
    <form ref={formRef} action={enviar} className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input
          name="nombre"
          required
          placeholder="Nombre de la categoría"
          autoComplete="off"
          className={`${clsEntrada} flex-1 uppercase`}
        />
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primary px-4 text-sm font-semibold text-tinta-inversa hover:bg-primary-hover disabled:opacity-60"
        >
          {pendiente ? "…" : "Agregar"}
        </button>
      </div>
      {estado && "error" in estado && (
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
          {estado.error}
        </p>
      )}
    </form>
  );
}
