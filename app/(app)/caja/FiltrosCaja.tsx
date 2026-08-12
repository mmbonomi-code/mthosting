"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clsEntrada } from "@/lib/ui";
import { nombreDelMes, sumarMeses } from "@/lib/fechas";

/**
 * Período y filtros de la caja. Todo va en la dirección, así que una vista
 * filtrada se puede pasar por mensaje y abre igual.
 */
export default function FiltrosCaja({
  mes,
  q,
  tipo,
  categoria,
  depto,
  soloPorCobrar,
  categorias,
  departamentos,
}: {
  mes: string;
  q: string;
  tipo: string;
  categoria: string;
  depto: string;
  soloPorCobrar: boolean;
  categorias: { id: string; nombre: string }[];
  departamentos: { id: string; codigo: string }[];
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);

  const url = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    const valores: Record<string, string> = {
      mes,
      q: texto,
      tipo,
      categoria,
      depto,
      cobrar: soloPorCobrar ? "1" : "",
      ...cambios,
    };
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor) p.set(clave, valor);
    }
    return `/caja?${p.toString()}`;
  };

  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => router.replace(url({ q: texto })), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <div className="flex flex-col gap-3">
      {/* Con "por cobrar" se mira una deuda, no un mes: el navegador de
          período no aplica y se apaga para que no confunda. */}
      <div className={`flex items-center gap-2 ${soloPorCobrar ? "opacity-40" : ""}`}>
        <Link
          href={url({ mes: sumarMeses(mes, -1), cobrar: "" })}
          aria-label="Mes anterior"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          ←
        </Link>
        <span className="flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3 text-base capitalize text-white">
          {soloPorCobrar ? "Toda la historia" : nombreDelMes(mes)}
        </span>
        <Link
          href={url({ mes: sumarMeses(mes, 1), cobrar: "" })}
          aria-label="Mes siguiente"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          →
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar por detalle, categoría o departamento"
          aria-label="Buscar en la caja"
          className={`${clsEntrada} min-w-48 flex-1`}
        />
        <select
          value={tipo}
          onChange={(e) => router.replace(url({ tipo: e.target.value }))}
          aria-label="Filtrar por tipo"
          className={clsEntrada}
        >
          <option value="">Ingresos y egresos</option>
          <option value="ingreso">Solo ingresos</option>
          <option value="egreso">Solo egresos</option>
        </select>
        <select
          value={categoria}
          onChange={(e) => router.replace(url({ categoria: e.target.value }))}
          aria-label="Filtrar por categoría"
          className={clsEntrada}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
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
        <Link
          href={url({ cobrar: soloPorCobrar ? "" : "1" })}
          className={`flex items-center rounded-lg border px-3 py-2 text-sm transition-colors ${
            soloPorCobrar
              ? "border-amber-500 bg-amber-950/40 text-amber-200"
              : "border-slate-700 text-slate-300 hover:bg-slate-800"
          }`}
        >
          Por cobrar
        </Link>
      </div>
    </div>
  );
}
