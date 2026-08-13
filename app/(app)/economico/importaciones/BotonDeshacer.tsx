"use client";

import { useState, useTransition } from "react";
import { deshacerImportacion } from "../acciones";

export default function BotonDeshacer({
  importId,
  filas,
}: {
  importId: string;
  filas: number;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const [pendiente, comenzar] = useTransition();

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
      >
        Deshacer
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-amber-200">
        ¿Sacar las {filas.toLocaleString("es-AR")} filas de esta carga?
      </span>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => comenzar(() => deshacerImportacion(importId))}
        className="rounded-lg bg-red-900 px-3 py-1.5 text-sm font-medium text-red-100 transition-colors hover:bg-red-800 disabled:opacity-60"
      >
        {pendiente ? "Deshaciendo…" : "Sí, deshacer"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="px-2 py-1.5 text-sm text-slate-400 hover:text-white"
      >
        No
      </button>
    </div>
  );
}
