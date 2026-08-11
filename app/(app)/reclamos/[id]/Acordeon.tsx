"use client";

import { useState } from "react";

/**
 * Los bloques de la ficha: título en mayúsculas, borde izquierdo y fondo
 * suave, como el prototipo. Arrancan abiertos porque en una ficha corta
 * esconder cosas hace perder tiempo.
 */
export default function Acordeon({
  titulo,
  contador,
  children,
  abiertoInicial = true,
}: {
  titulo: string;
  contador?: number;
  children: React.ReactNode;
  abiertoInicial?: boolean;
}) {
  const [abierto, setAbierto] = useState(abiertoInicial);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-800">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full items-center gap-2 border-l-4 border-l-slate-500 bg-slate-800/70 px-3 py-2.5 text-left transition-colors hover:bg-slate-800"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          {titulo}
          {contador !== undefined && ` (${contador})`}
        </span>
        <span className="ml-auto text-slate-400">{abierto ? "▾" : "▸"}</span>
      </button>
      {abierto && <div className="p-4">{children}</div>}
    </section>
  );
}
