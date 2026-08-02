"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { EstadoFormulario } from "../../acciones";
import { clsBotonPrimario, clsBotonSecundario, clsEntrada } from "@/lib/ui";

export type ItemEquipamiento = {
  id: string;
  nombre: string;
  categoria: string | null;
  tiene: boolean;
  detalle: string | null;
};

function GrupoEquipamiento({
  categoria,
  items,
}: {
  categoria: string;
  items: ItemEquipamiento[];
}) {
  const [marcados, setMarcados] = useState(
    () => new Set(items.filter((i) => i.tiene).map((i) => i.id)),
  );

  return (
    <details
      open
      className="group rounded-xl border border-slate-800"
    >
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-white [&::-webkit-details-marker]:hidden">
        <span className="font-medium">{categoria}</span>
        <span className="flex items-center gap-3">
          <span className="text-sm text-slate-500">
            {marcados.size} / {items.length}
          </span>
          <span className="text-slate-500 transition-transform group-open:rotate-180">
            ▾
          </span>
        </span>
      </summary>
      <ul className="flex flex-col gap-2 border-t border-slate-800 px-4 py-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-col gap-2 sm:flex-row sm:items-center"
          >
            <label className="flex min-w-56 items-center gap-3">
              <input
                type="checkbox"
                name={`tiene_${item.id}`}
                defaultChecked={item.tiene}
                onChange={(e) =>
                  setMarcados((previos) => {
                    const siguientes = new Set(previos);
                    if (e.target.checked) siguientes.add(item.id);
                    else siguientes.delete(item.id);
                    return siguientes;
                  })
                }
                className="size-5 shrink-0 accent-white"
              />
              <span className="text-base text-slate-200">{item.nombre}</span>
            </label>
            <input
              name={`detalle_${item.id}`}
              defaultValue={item.detalle ?? ""}
              placeholder="Detalle (opcional)"
              className={`${clsEntrada} sm:flex-1`}
            />
          </li>
        ))}
      </ul>
    </details>
  );
}

export default function FormularioEquipamiento({
  accion,
  items,
  urlCancelar,
}: {
  accion: (
    estadoPrevio: EstadoFormulario,
    fd: FormData,
  ) => Promise<EstadoFormulario>;
  items: ItemEquipamiento[];
  urlCancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  const categorias = items.reduce<Record<string, ItemEquipamiento[]>>(
    (grupos, item) => {
      const clave = item.categoria ?? "Otros";
      (grupos[clave] ??= []).push(item);
      return grupos;
    },
    {},
  );

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {Object.entries(categorias).map(([categoria, itemsDelGrupo]) => (
        <GrupoEquipamiento
          key={categoria}
          categoria={categoria}
          items={itemsDelGrupo}
        />
      ))}

      {estado?.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300"
        >
          {estado.error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Guardando…" : "Guardar equipamiento"}
        </button>
        <Link
          href={urlCancelar}
          className={`${clsBotonSecundario} flex items-center`}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
