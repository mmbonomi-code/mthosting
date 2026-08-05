"use client";

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
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
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
        className="h-11 min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 text-base text-white outline-none focus:border-slate-400"
      />
      <Link
        href="/semana"
        className="flex h-11 shrink-0 items-center rounded-lg border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-800"
      >
        Hoy
      </Link>
      <Link
        href={`/semana?desde=${sumarDias(desde, 7)}`}
        aria-label="Semana siguiente"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
      >
        →
      </Link>
    </div>
  );
}
