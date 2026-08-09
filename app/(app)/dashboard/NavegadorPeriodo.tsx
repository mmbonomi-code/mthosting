"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { nombreDelMes, sumarMeses } from "@/lib/fechas";

/**
 * El período del dashboard: se navega por mes, que es como se mira el
 * negocio, y se puede abrir un rango libre para los casos sueltos
 * (una temporada, un trimestre, lo que se le ocurra a la manager).
 */
export default function NavegadorPeriodo({
  mes,
  desde,
  hasta,
  esRangoLibre,
}: {
  mes: string;
  desde: string;
  /** Inclusivo, para mostrar: la última noche del período. */
  hasta: string;
  esRangoLibre: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(esRangoLibre);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Link
          href={`/dashboard?mes=${sumarMeses(mes, -1)}`}
          aria-label="Mes anterior"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          ←
        </Link>
        <span className="flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-3 text-base capitalize text-white">
          {esRangoLibre ? "Rango elegido" : nombreDelMes(mes)}
        </span>
        <Link
          href={`/dashboard?mes=${sumarMeses(mes, 1)}`}
          aria-label="Mes siguiente"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          →
        </Link>
      </div>

      {abierto ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            router.push(`/dashboard?desde=${fd.get("desde")}&hasta=${fd.get("hasta")}`);
          }}
        >
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              required
              className="h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-base text-white outline-none focus:border-slate-400"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-500">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              required
              className="h-11 rounded-lg border border-slate-700 bg-slate-800 px-3 text-base text-white outline-none focus:border-slate-400"
            />
          </label>
          <button
            type="submit"
            className="h-11 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 hover:bg-slate-200"
          >
            Ver
          </button>
          {esRangoLibre && (
            <Link
              href="/dashboard"
              className="flex h-11 items-center rounded-lg border border-slate-700 px-4 text-sm text-slate-300 hover:bg-slate-800"
            >
              Volver al mes
            </Link>
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
    </div>
  );
}
