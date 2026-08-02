"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../acciones";
import { clsEntrada } from "@/lib/ui";

export default function FormularioInventario({
  accion,
  sugerencias,
}: {
  accion: (
    estadoPrevio: EstadoFormulario,
    fd: FormData,
  ) => Promise<EstadoFormulario>;
  sugerencias: string[];
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          name="item_nombre"
          required
          list="items-catalogo"
          placeholder="Ítem (Plancha, AAC, Secador…)"
          className={clsEntrada}
        />
        <datalist id="items-catalogo">
          {sugerencias.map((nombre) => (
            <option key={nombre} value={nombre} />
          ))}
        </datalist>
        <input
          name="cantidad"
          type="number"
          min={1}
          defaultValue={1}
          className={`${clsEntrada} sm:w-24`}
        />
        <input
          name="notas"
          placeholder="Notas (opcional)"
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
