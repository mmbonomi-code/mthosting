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
          className="rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "…" : "Agregar"}
        </button>
      </div>
      {estado && "error" in estado && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      )}
    </form>
  );
}
