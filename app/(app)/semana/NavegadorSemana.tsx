"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { sumarDias } from "@/lib/fechas";

/**
 * Flechas de semana, "Hoy" y un calendario para saltar a cualquier fecha.
 *
 * Todo a 44px de alto: se usa desde el celular, en la calle, y nada tocable
 * puede bajar de ahí (docs/IDENTIDAD-VISUAL.md §7).
 */
const CONTROL =
  "flex h-11 shrink-0 items-center justify-center rounded-sm border border-borde-control text-tinta-suave transition-colors hover:bg-superficie-hover";

export default function NavegadorSemana({ desde }: { desde: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/semana?desde=${sumarDias(desde, -7)}`}
        aria-label="Semana anterior"
        className={`${CONTROL} w-11`}
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
        className="h-11 min-w-0 flex-1 rounded-sm border border-borde-control bg-superficie px-3 text-base text-tinta tabular-nums outline-none focus:border-primary"
      />
      <Link href="/semana" className={`${CONTROL} px-3 text-sm`}>
        Hoy
      </Link>
      <Link
        href={`/semana?desde=${sumarDias(desde, 7)}`}
        aria-label="Semana siguiente"
        className={`${CONTROL} w-11`}
      >
        →
      </Link>
    </div>
  );
}
