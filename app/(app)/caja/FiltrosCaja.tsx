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
  desde,
  hasta,
  esRangoLibre,
  q,
  tipo,
  categoria,
  depto,
  soloPorCobrar,
  categorias,
  departamentos,
}: {
  mes: string;
  desde: string;
  /** Inclusivo: el último día del período. */
  hasta: string;
  esRangoLibre: boolean;
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
  const [abierto, setAbierto] = useState(esRangoLibre);

  const url = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    const valores: Record<string, string> = {
      // Mes y rango libre son excluyentes: el que se elige pisa al otro.
      mes: esRangoLibre ? "" : mes,
      desde: esRangoLibre ? desde : "",
      hasta: esRangoLibre ? hasta : "",
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

  /** La misma dirección pero contra el exportador. */
  const urlExportar = (formato: "xlsx" | "csv") => {
    const p = new URLSearchParams({ formato });
    if (esRangoLibre) {
      p.set("desde", desde);
      p.set("hasta", hasta);
    } else p.set("mes", mes);
    return `/api/exportar/caja?${p.toString()}`;
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
          href={url({ mes: sumarMeses(mes, -1), desde: "", hasta: "", cobrar: "" })}
          aria-label="Mes anterior"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          ←
        </Link>
        <span className="flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3 text-base capitalize text-white">
          {soloPorCobrar
            ? "Toda la historia"
            : esRangoLibre
              ? "Rango elegido"
              : nombreDelMes(mes)}
        </span>
        <Link
          href={url({ mes: sumarMeses(mes, 1), desde: "", hasta: "", cobrar: "" })}
          aria-label="Mes siguiente"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          →
        </Link>
      </div>

      {abierto ? (
        <form
          className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-800 bg-slate-800/40 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const p = new URLSearchParams({
              desde: String(fd.get("desde")),
              hasta: String(fd.get("hasta")),
            });
            if (texto) p.set("q", texto);
            if (tipo) p.set("tipo", tipo);
            if (categoria) p.set("categoria", categoria);
            if (depto) p.set("depto", depto);
            router.push(`/caja?${p.toString()}`);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              required
              className={clsEntrada}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              required
              className={clsEntrada}
            />
          </label>
          <button
            type="submit"
            className="h-11 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-200"
          >
            Ver
          </button>
          {esRangoLibre ? (
            <Link
              href="/caja"
              className="flex h-11 items-center rounded-lg border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800"
            >
              Volver al mes
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="h-11 rounded-lg px-3 text-sm text-slate-400 hover:bg-slate-800"
            >
              Cerrar
            </button>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="self-start text-sm text-slate-400 underline decoration-slate-700 underline-offset-4 hover:text-white"
        >
          Elegir un rango de fechas
        </button>
      )}

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

        {/* Exporta el período que se está mirando, con el saldo acumulado. */}
        <a
          href={urlExportar("xlsx")}
          className="flex items-center rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
        >
          Exportar Excel
        </a>
        <a
          href={urlExportar("csv")}
          className="flex items-center rounded-lg px-2 py-2 text-sm text-slate-500 transition-colors hover:text-slate-300"
        >
          CSV
        </a>
      </div>
    </div>
  );
}
