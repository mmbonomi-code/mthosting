"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clsEntrada } from "@/lib/ui";
import { ETIQUETA_ESTADO } from "@/lib/reclamos/estados";
import type { EstadoReclamo } from "@/lib/reclamos/plazos";
import type { Foco } from "@/lib/reclamos/lista";

const ESTADOS: EstadoReclamo[] = [
  "borrador",
  "por_presentar",
  "presentado",
  "escalado",
  "cobrado",
  "rechazado",
  "descartado",
];

/** Buscador y filtros de la lista. Escribir filtra sin apretar nada. */
export default function FiltrosReclamos({
  q,
  estado,
  depto,
  foco,
  departamentos,
}: {
  q: string;
  estado: string;
  depto: string;
  foco: Foco;
  departamentos: { id: string; codigo: string }[];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);

  const url = (cambios: { q?: string; estado?: string; depto?: string }) => {
    const p = new URLSearchParams();
    const valores = { q: texto, estado, depto, ...cambios };
    if (valores.q) p.set("q", valores.q);
    if (valores.estado) p.set("estado", valores.estado);
    if (valores.depto) p.set("depto", valores.depto);
    if (foco) p.set("foco", foco);
    const qs = p.toString();
    return qs ? `/reclamos?${qs}` : "/reclamos";
  };

  // Se espera a que deje de escribir para no navegar en cada tecla.
  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => router.replace(url({ q: texto })), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <div className="flex flex-wrap gap-2 rounded-xl border border-slate-800 bg-slate-800/40 p-3">
      <input
        type="search"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Buscar por código, huésped, departamento o motivo"
        aria-label="Buscar reclamos"
        className={`${clsEntrada} min-w-56 flex-1`}
      />
      <select
        value={estado}
        onChange={(e) => router.replace(url({ estado: e.target.value }))}
        aria-label="Filtrar por estado"
        className={clsEntrada}
      >
        <option value="">Todos los estados</option>
        {ESTADOS.map((e) => (
          <option key={e} value={e}>
            {ETIQUETA_ESTADO[e]}
          </option>
        ))}
      </select>
      <select
        value={depto}
        onChange={(e) => router.replace(url({ depto: e.target.value }))}
        aria-label="Filtrar por departamento"
        className={clsEntrada}
      >
        <option value="">Todos los departamentos</option>
        {departamentos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.codigo}
          </option>
        ))}
      </select>
    </div>
  );
}
