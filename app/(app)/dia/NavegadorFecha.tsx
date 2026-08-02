"use client";

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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
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
        className="h-11 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 text-base text-white outline-none focus:border-slate-400"
      />
      <Link
        href="/dia"
        className="flex h-11 shrink-0 items-center rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
      >
        Hoy
      </Link>
      <Link
        href={`/dia?fecha=${sumarDias(fecha, 1)}`}
        aria-label="Día siguiente"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
      >
        →
      </Link>
    </div>
  );
}
