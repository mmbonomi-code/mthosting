"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { sumarDias } from "@/lib/fechas";

/**
 * Flechas, "Hoy" y un calendario para saltar a cualquier fecha (spec §3.1).
 *
 * Todo a 44px de alto: esta pantalla se usa desde la calle y nada tocable
 * puede bajar de ahí (docs/IDENTIDAD-VISUAL.md §8.2).
 */
const CONTROL =
  "flex h-11 shrink-0 items-center justify-center rounded-md border border-borde-control text-tinta-suave transition-colors hover:bg-superficie-hover";

export default function NavegadorFecha({ fecha }: { fecha: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/dia?fecha=${sumarDias(fecha, -1)}`}
        aria-label="Día anterior"
        className={`${CONTROL} w-11`}
      >
        ←
      </Link>
      <input
        type="date"
        value={fecha}
        onChange={(e) => {
          if (e.target.value) router.push(`/dia?fecha=${e.target.value}`);
        }}
        aria-label="Elegir fecha"
        className="h-11 min-w-0 flex-1 rounded-md border border-borde-control bg-superficie px-3 text-base text-tinta tabular-nums outline-none focus:border-primary"
      />
      <Link href="/dia" className={`${CONTROL} px-3 text-sm`}>
        Hoy
      </Link>
      <Link
        href={`/dia?fecha=${sumarDias(fecha, 1)}`}
        aria-label="Día siguiente"
        className={`${CONTROL} w-11`}
      >
        →
      </Link>
    </div>
  );
}
