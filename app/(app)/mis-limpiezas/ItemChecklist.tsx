"use client";

import { useState, useTransition } from "react";
import { usePendientes } from "./PendientesProvider";

/**
 * Un ítem del checklist: se guarda solo al tildarlo, sin botón aparte.
 *
 * El tilde se ve al instante y el envío va por la cola: adentro de un
 * edificio sin señal la persona sigue trabajando igual, y lo que no salió se
 * manda cuando vuelve la conexión (spec Fase 2 §10).
 */
export default function ItemChecklist({
  limpiezaId,
  filaId,
  etiqueta,
  hechoInicial,
  chip,
}: {
  limpiezaId: string;
  filaId: string;
  etiqueta: string;
  hechoInicial: boolean;
  /** "hace N días · cada X" en una tarea periódica vencida, o null. */
  chip?: string | null;
}) {
  const [hecho, setHecho] = useState(hechoInicial);
  const [, iniciar] = useTransition();
  const { registrar } = usePendientes();

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
            await registrar({ clase: "checklist", limpiezaId, filaId, hecho: valor });
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
