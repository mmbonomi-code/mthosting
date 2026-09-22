"use client";

import { clsBoton } from "@/lib/ui";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { sumarDias } from "@/lib/fechas";

/** Flechas, "Hoy" y un calendario para saltar a cualquier fecha (spec §3.1). */
export default function NavegadorFecha({ fecha }: { fecha: string }) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/dia?fecha=${sumarDias(fecha, -1)}`}
        aria-label="Día anterior"
        className={`${clsBoton("secundario", "icono")} shrink-0`}
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
        className="h-11 flex-1 rounded-lg border border-borde-control bg-elevada px-3 text-base text-tinta outline-none focus:border-primary"
      />
      <Link
        href="/dia"
        className={`${clsBoton("secundario")} shrink-0`}
      >
        Hoy
      </Link>
      <Link
        href={`/dia?fecha=${sumarDias(fecha, 1)}`}
        aria-label="Día siguiente"
        className={`${clsBoton("secundario", "icono")} shrink-0`}
      >
        →
      </Link>
    </div>
  );
}
