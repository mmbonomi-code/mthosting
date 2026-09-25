"use client";

import { clsBoton } from "@/lib/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sumarDias } from "@/lib/fechas";

/**
 * Flechas de semana, "Hoy" y un calendario para saltar a cualquier fecha.
 *
 * `extra` son los parámetros que hay que conservar al navegar — hoy, la
 * persona por la que se está filtrando: cambiar de semana no la pierde.
 */
export default function NavegadorSemana({
  desde,
  extra = "",
}: {
  desde: string;
  extra?: string;
}) {
  const router = useRouter();
  const con = (fecha?: string) => {
    const qs = new URLSearchParams(extra);
    if (fecha) qs.set("desde", fecha);
    return qs.size > 0 ? `/semana?${qs}` : "/semana";
  };

  return (
    <div className="flex items-center gap-2">
      <Link
        href={con(sumarDias(desde, -7))}
        aria-label="Semana anterior"
        className={`${clsBoton("secundario", "icono")} shrink-0`}
      >
        ←
      </Link>
      <input
        type="date"
        value={desde}
        onChange={(e) => {
          if (e.target.value) router.push(con(e.target.value));
        }}
        aria-label="Elegir fecha"
        className="h-11 min-w-0 flex-1 rounded-lg border border-borde-control bg-elevada px-3 text-base text-tinta outline-none focus:border-primary"
      />
      <Link
        href={con()}
        className={`${clsBoton("secundario")} shrink-0`}
      >
        Hoy
      </Link>
      <Link
        href={con(sumarDias(desde, 7))}
        aria-label="Semana siguiente"
        className={`${clsBoton("secundario", "icono")} shrink-0`}
      >
        →
      </Link>
    </div>
  );
}
