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
        className="rounded-lg border border-borde-control px-3 py-1.5 text-sm text-tinta-tenue transition-colors hover:bg-elevada hover:text-tinta"
      >
        Deshacer
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-aviso-text-fuerte">
        ¿Sacar las {filas.toLocaleString("es-AR")} filas de esta carga?
      </span>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => comenzar(() => deshacerImportacion(importId))}
        className="rounded-lg bg-error-borde px-3 py-1.5 text-sm font-medium text-error-text-fuerte transition-colors hover:bg-error-borde disabled:opacity-60"
      >
        {pendiente ? "Deshaciendo…" : "Sí, deshacer"}
      </button>
      <button
        type="button"
        onClick={() => setConfirmando(false)}
        className="px-2 py-1.5 text-sm text-tinta-tenue hover:text-tinta"
      >
        No
      </button>
    </div>
  );
}
