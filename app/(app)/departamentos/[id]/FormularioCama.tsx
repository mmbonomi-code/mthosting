"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../acciones";
import { ETIQUETA_TIPO_CAMA } from "@/lib/etiquetas";
import { clsEntrada } from "@/lib/ui";

export default function FormularioCama({
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
        <input
          name="ambiente"
          required
          placeholder="Ambiente (Habitación 1, Living…)"
          className={clsEntrada}
        />
        <select
          name="tipo_cama"
          required
          defaultValue=""
          className={`${clsEntrada} sm:w-48`}
        >
          <option value="" disabled>
            Tipo de cama…
          </option>
          {Object.entries(ETIQUETA_TIPO_CAMA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
        <input
          name="cantidad"
          type="number"
          min={1}
          defaultValue={1}
          className={`${clsEntrada} sm:w-24`}
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
