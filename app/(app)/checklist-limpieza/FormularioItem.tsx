"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoFormulario } from "./acciones";
import { clsBotonPrimario, clsBotonSecundario, clsEntrada, clsEtiqueta } from "@/lib/ui";

type Valores = {
  seccion?: string | null;
  item?: string | null;
  activo?: boolean;
};

export default function FormularioItem({
  accion,
  valores = {},
  secciones,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  valores?: Valores;
  secciones: string[];
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(accion, null);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Sección *</span>
        <input
          name="seccion"
          required
          list="secciones-existentes"
          defaultValue={valores.seccion ?? ""}
          placeholder="Cocina, Funcionamiento, Baño, Habitación…"
          className={clsEntrada}
        />
        <datalist id="secciones-existentes">
          {secciones.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <span className="text-xs text-slate-500">
          Una existente lo suma a esa sección. Una nueva crea la sección.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Ítem *</span>
        <input
          name="item"
          required
          defaultValue={valores.item ?? ""}
          placeholder="Ej: Heladera vacía y limpia por dentro"
          className={clsEntrada}
        />
      </label>

      <label className="flex items-center gap-3 py-1">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={valores.activo ?? true}
          className="size-5 accent-white"
        />
        <span className="text-base text-slate-200">Activo</span>
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
