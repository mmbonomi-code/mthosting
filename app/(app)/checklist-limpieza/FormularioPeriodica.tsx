"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoFormulario } from "./acciones";
import { clsBotonPrimario, clsBotonSecundario, clsEntrada, clsEtiqueta } from "@/lib/ui";

type Valores = {
  item?: string | null;
  frecuencia_dias?: number | null;
  activo?: boolean;
};

export default function FormularioPeriodica({
  accion,
  valores = {},
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  valores?: Valores;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(accion, null);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Tarea *</span>
        <input
          name="item"
          required
          defaultValue={valores.item ?? ""}
          placeholder="Ej: Vidrios de las ventanas"
          className={clsEntrada}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Frecuencia (en días) *</span>
        <input
          type="number"
          name="frecuencia_dias"
          required
          min={1}
          defaultValue={valores.frecuencia_dias ?? ""}
          placeholder="15"
          className={`${clsEntrada} sm:w-32`}
        />
        <span className="text-xs text-slate-500">
          A partir de cuántos días sin hacerla se le avisa a quien limpia.
        </span>
      </label>

      <label className="flex items-center gap-3 py-1">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={valores.activo ?? true}
          className="size-5 accent-white"
        />
        <span className="text-base text-slate-200">Activa</span>
      </label>

      {estado?.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {estado.error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <Link href="/checklist-limpieza" className={`${clsBotonSecundario} flex items-center`}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
