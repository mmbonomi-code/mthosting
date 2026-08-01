"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../acciones";
import { clsEntrada } from "@/lib/ui";

export default function FormularioAlias({
  accion,
}: {
  accion: (
    estadoPrevio: EstadoFormulario,
    fd: FormData,
  ) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select name="canal" defaultValue="airbnb" className={`${clsEntrada} sm:w-36`}>
          <option value="airbnb">Airbnb</option>
          <option value="booking">Booking</option>
          <option value="directa">Directa</option>
        </select>
        <input
          name="nombre_listing"
          required
          placeholder="Nombre del anuncio, tal cual aparece en el canal"
          className={clsEntrada}
        />
        <button
          type="submit"
          disabled={pendiente}
          className="h-11 shrink-0 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Agregando…" : "Agregar"}
        </button>
      </div>
      {estado?.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      )}
    </form>
  );
}
