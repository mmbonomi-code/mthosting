"use client";

import { clsBoton } from "@/lib/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sumarDias } from "@/lib/fechas";

/** Flechas de semana, "Hoy" y un calendario para saltar a cualquier fecha. */
export default function NavegadorSemana({ desde }: { desde: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/semana?desde=${sumarDias(desde, -7)}`}
        aria-label="Semana anterior"
        className={`${clsBoton("secundario", "icono")} shrink-0`}
      >
        ←
      </Link>
      <input
        type="date"
        value={desde}
        onChange={(e) => {
          if (e.target.value) router.push(`/semana?desde=${e.target.value}`);
        }}
        aria-label="Elegir fecha"
        className="h-11 min-w-0 flex-1 rounded-lg border border-borde-control bg-elevada px-3 text-base text-tinta outline-none focus:border-primary"
      />
      <Link
        href="/semana"
        className={`${clsBoton("secundario")} shrink-0`}
      >
        Hoy
      </Link>
      <Link
        href={`/semana?desde=${sumarDias(desde, 7)}`}
        aria-label="Semana siguiente"
        className={`${clsBoton("secundario", "icono")} shrink-0`}
      >
        →
      </Link>
    </div>
  );
}
