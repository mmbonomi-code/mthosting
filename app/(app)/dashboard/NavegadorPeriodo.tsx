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
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-borde-control text-tinta-suave hover:bg-superficie-alt"
        >
          ←
        </Link>
        <span className="flex h-11 flex-1 items-center justify-center rounded-md border border-borde-control bg-superficie-alt px-3 text-base capitalize text-tinta">
          {esRangoLibre ? "Rango elegido" : nombreDelMes(mes)}
        </span>
        <Link
          href={`/dashboard?mes=${sumarMeses(mes, 1)}`}
          aria-label="Mes siguiente"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-borde-control text-tinta-suave hover:bg-superficie-alt"
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
            <span className="text-xs uppercase tracking-wide text-tinta-tenue">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              required
              className="h-11 rounded-md border border-borde-control bg-superficie-alt px-3 text-base text-tinta outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-tinta-tenue">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              required
              className="h-11 rounded-md border border-borde-control bg-superficie-alt px-3 text-base text-tinta outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className="h-11 rounded-md bg-primary px-4 text-sm font-semibold text-tinta-inversa hover:bg-primary-hover"
          >
            Ver
          </button>
          {esRangoLibre && (
            <Link
              href="/dashboard"
              className="flex h-11 items-center rounded-md border border-borde-control px-4 text-sm text-tinta-suave hover:bg-superficie-alt"
            >
              Volver al mes
            </Link>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="self-start text-sm text-tinta-suave underline decoration-borde-fuerte underline-offset-4 hover:text-tinta"
        >
          Elegir un rango de fechas
        </button>
      )}
    </div>
  );
}
