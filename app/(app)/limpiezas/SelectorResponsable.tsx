"use client";

import { useState, useTransition } from "react";

export type PersonaOpcion = { id: string; nombre: string };

/**
 * Asignar desde el listado, sin entrar a la ficha: se elige y se guarda
 * solo. Es la operación que más se repite al repartir el trabajo.
 */
export default function SelectorResponsable({
  personas,
  asignadoA,
  accion,
}: {
  personas: PersonaOpcion[];
  asignadoA: string | null;
  accion: (personaId: string | null) => Promise<void>;
}) {
  const [valor, setValor] = useState(asignadoA ?? "");
  const [pendiente, iniciar] = useTransition();

  return (
    <select
      value={valor}
      disabled={pendiente}
      aria-label="Responsable"
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const nuevo = e.target.value;
        setValor(nuevo);
        iniciar(async () => {
          await accion(nuevo === "" ? null : nuevo);
        });
      }}
      className={`h-9 max-w-44 rounded-lg border px-2 text-sm outline-none transition-colors ${
        valor
          ? "border-emerald-800 bg-emerald-950/40 text-emerald-200"
          : "border-amber-800 bg-amber-950/30 text-amber-200"
      } ${pendiente ? "opacity-60" : ""}`}
    >
      <option value="">Sin asignar</option>
      {personas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
        </option>
      ))}
    </select>
  );
}
