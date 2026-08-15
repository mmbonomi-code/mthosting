"use client";

import { useState, useTransition } from "react";

export type PersonaOpcion = { id: string; nombre: string };

/**
 * Asignar desde el listado, sin entrar a la ficha: se elige y se guarda solo.
 * Es la operación que más se repite al repartir el trabajo.
 *
 * Sin asignar va en el acento, con el resto de la fila; una vez asignada se
 * apaga. Lo que tiene que saltar es lo que falta hacer, no lo que ya está
 * resuelto (docs/IDENTIDAD-VISUAL.md).
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
      // 44px: se usa desde el celular.
      className={`h-11 max-w-44 rounded-md border px-2 text-sm outline-none transition-colors focus:border-primary ${
        valor
          ? "border-borde-control bg-superficie text-tinta"
          : "border-accent bg-accent-soft text-accent-soft-text font-medium"
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
