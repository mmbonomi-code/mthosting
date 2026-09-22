"use client";

import { clsBoton } from "@/lib/ui";
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
          className={`${clsBoton("secundario")} w-11 shrink-0`}
        >
          ←
        </Link>
        <span className="flex h-11 flex-1 items-center justify-center rounded-lg border border-borde-control bg-elevada px-3 text-base capitalize text-tinta">
          {esRangoLibre ? "Rango elegido" : nombreDelMes(mes)}
        </span>
        <Link
          href={`/dashboard?mes=${sumarMeses(mes, 1)}`}
          aria-label="Mes siguiente"
          className={`${clsBoton("secundario")} w-11 shrink-0`}
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
            <span className="text-xs uppercase tracking-wide text-tinta-etiqueta">Desde</span>
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              required
              className="h-11 rounded-lg border border-borde-control bg-elevada px-3 text-base text-tinta outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-tinta-etiqueta">Hasta</span>
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              required
              className="h-11 rounded-lg border border-borde-control bg-elevada px-3 text-base text-tinta outline-none focus:border-primary"
            />
          </label>
          <button
            type="submit"
            className={clsBoton("primario")}
          >
            Ver
          </button>
          {esRangoLibre && (
            <Link
              href="/dashboard"
              className={clsBoton("secundario")}
            >
              Volver al mes
            </Link>
          )}
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="self-start text-sm text-tinta-tenue underline decoration-tinta-apagada underline-offset-4 hover:text-tinta"
        >
          Elegir un rango de fechas
        </button>
      )}
    </div>
  );
}
