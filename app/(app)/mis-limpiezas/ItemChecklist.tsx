"use client";

import { useState, useTransition } from "react";

/** Un ítem del checklist: se guarda solo al tildarlo, sin botón aparte. */
export default function ItemChecklist({
  etiqueta,
  hechoInicial,
  chip,
  accion,
}: {
  etiqueta: string;
  hechoInicial: boolean;
  /** "hace N días · cada X" en una tarea periódica vencida, o null. */
  chip?: string | null;
  accion: (hecho: boolean) => Promise<void>;
}) {
  const [hecho, setHecho] = useState(hechoInicial);
  const [, iniciar] = useTransition();

  return (
    <label
      className={`flex min-h-11 items-center gap-3 border-t border-slate-800 py-2.5 first:border-t-0 ${
        hecho ? "text-slate-500 line-through" : "text-slate-200"
      }`}
    >
      <input
        type="checkbox"
        checked={hecho}
        onChange={(e) => {
          const valor = e.target.checked;
          setHecho(valor);
          iniciar(async () => {
            await accion(valor);
          });
        }}
        className="size-5 shrink-0 accent-white"
      />
      <span className="min-w-0 flex-1">
        <span className="block">{etiqueta}</span>
        {chip && !hecho && (
          <span className="mt-0.5 inline-block rounded-full bg-amber-950/60 px-2 py-0.5 text-xs font-medium text-amber-300">
            {chip}
          </span>
        )}
      </span>
    </label>
  );
}
