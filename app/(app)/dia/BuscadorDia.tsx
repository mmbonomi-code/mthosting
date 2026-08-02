"use client";

import Link from "next/link";
import { clsEntrada } from "@/lib/ui";

/**
 * Una sola caja de búsqueda, arriba de todo: en la calle no se filtra, se
 * busca (spec §3.1). Busca por código, huésped, departamento o teléfono.
 */
export default function BuscadorDia({
  q,
  fecha,
}: {
  q: string;
  fecha: string;
}) {
  return (
    <form action="/dia" method="get" className="flex gap-2">
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Buscar huésped, código, depto o teléfono…"
        className={clsEntrada}
        autoComplete="off"
      />
      <input type="hidden" name="fecha" value={fecha} />
      {q && (
        <Link
          href={`/dia?fecha=${fecha}`}
          className="flex h-11 shrink-0 items-center rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
        >
          Limpiar
        </Link>
      )}
    </form>
  );
}
