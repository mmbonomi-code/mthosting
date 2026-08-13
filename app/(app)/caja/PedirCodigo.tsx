"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EstadoFormulario } from "@/lib/caja/tipos";

/**
 * La cortina de la caja. No reemplaza al permiso —para llegar acá ya hay que
 * ser manager o administración— sino que evita mostrar la plata de entrada
 * en una pantalla que puede estar a la vista de cualquiera.
 */
export default function PedirCodigo({
  accion,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-white">Caja</h1>
        <p className="mt-1 text-sm text-slate-400">
          Poné el código para ver los movimientos.
        </p>
      </div>

      <form action={enviar} className="flex flex-col gap-3">
        <input
          autoFocus
          type="password"
          name="codigo"
          inputMode="numeric"
          autoComplete="off"
          required
          aria-label="Código de la caja"
          placeholder="••••"
          className="h-14 rounded-xl border border-slate-700 bg-slate-800 text-center text-2xl tracking-[0.5em] text-white outline-none focus:border-slate-400"
        />

        {estado && "error" in estado && (
          <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-center text-sm text-red-300">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="h-12 rounded-xl bg-white text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <Link href="/" className="text-center text-sm text-slate-500 hover:text-slate-300">
        Volver al inicio
      </Link>
    </main>
  );
}
