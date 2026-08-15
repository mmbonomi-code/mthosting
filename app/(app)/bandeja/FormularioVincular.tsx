"use client";

import { useActionState } from "react";
import type { EstadoMapeo } from "./acciones";
import { clsEntrada } from "@/lib/ui";

export type DeptoOpcion = { id: string; codigo: string; nombre_interno: string };

export default function FormularioVincular({
  accion,
  departamentos,
}: {
  accion: (estadoPrevio: EstadoMapeo, fd: FormData) => Promise<EstadoMapeo>;
  departamentos: DeptoOpcion[];
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoMapeo, FormData>(
    accion,
    null,
  );

  if (estado?.resultado === "ok") {
    return (
      <p className="rounded-md bg-exito-soft px-3 py-2 text-sm text-exito-text">
        ✓ Anuncio vinculado.{" "}
        {estado.asignadas === 1
          ? "1 reserva asignada"
          : `${estado.asignadas} reservas asignadas`}
        {estado.limpiezas > 0 &&
          `, con ${estado.limpiezas === 1 ? "su limpieza" : `sus ${estado.limpiezas} limpiezas`}`}
        . Ya aparecen en el día. Las próximas importaciones lo resuelven solas.
      </p>
    );
  }

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          name="depto_id"
          required
          defaultValue=""
          className={clsEntrada}
          aria-label="Departamento"
        >
          <option value="" disabled>
            Elegí a qué departamento corresponde…
          </option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo} — {d.nombre_interno}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pendiente}
          className="h-11 shrink-0 rounded-md bg-primary px-4 text-sm font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pendiente ? "Vinculando…" : "Vincular"}
        </button>
      </div>
      {estado?.resultado === "error" && (
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
          {estado.error}
        </p>
      )}
    </form>
  );
}
