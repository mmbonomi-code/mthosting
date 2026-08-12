"use client";

import { useActionState, useState } from "react";
import { clsEntrada, clsEtiqueta } from "@/lib/ui";
import { FORMAS_COBRO, type EstadoFormulario } from "@/lib/caja/tipos";
import type { DeudaPorDepto } from "@/lib/caja/saldo";

type Linea = {
  id: string;
  fecha: string;
  categoria: string;
  descripcion: string | null;
  monto: string;
};

/**
 * La deuda de un departamento, con sus movimientos. Se cobran todos juntos o
 * los que se elijan: así es como se cobra, no de a un gasto por vez.
 */
export default function CobroPorDepto({
  deuda,
  movimientos,
  totalTexto,
  desdeTexto,
  hoy,
  cobrar,
}: {
  deuda: DeudaPorDepto;
  movimientos: Linea[];
  totalTexto: string;
  desdeTexto: string;
  hoy: string;
  cobrar: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>(movimientos.map((m) => m.id));
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    cobrar,
    null,
  );

  const alternar = (id: string) =>
    setElegidos((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id],
    );

  return (
    <li className="overflow-hidden rounded-xl border border-slate-800 bg-slate-800/40">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-expanded={abierto}
        className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-800/60"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-slate-100">{deuda.depto_codigo}</span>
          <span className="block text-xs text-slate-500">
            {deuda.cantidad} movimiento{deuda.cantidad === 1 ? "" : "s"} · el más viejo
            del {desdeTexto}
          </span>
        </span>
        <span className="text-lg font-semibold tabular-nums text-amber-200">
          {totalTexto}
        </span>
        <span className="text-slate-400">{abierto ? "▾" : "▸"}</span>
      </button>

      {abierto && (
        <div className="border-t border-slate-800 px-4 py-3">
          <ul className="flex flex-col gap-1">
            {movimientos.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-800/60">
                  <input
                    type="checkbox"
                    checked={elegidos.includes(m.id)}
                    onChange={() => alternar(m.id)}
                    className="mt-1 size-4 shrink-0 accent-amber-400"
                  />
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="text-slate-200">
                      {m.fecha} · {m.categoria}
                    </span>
                    {m.descripcion && (
                      <span className="block truncate text-xs text-slate-500">
                        {m.descripcion}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-slate-300">
                    {m.monto}
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {cobrando ? (
            <form action={enviar} className="mt-3 flex flex-col gap-3 border-t border-slate-800 pt-3">
              {elegidos.map((id) => (
                <input key={id} type="hidden" name="ids" value={id} />
              ))}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className={clsEtiqueta}>Fecha del cobro</span>
                  <input
                    type="date"
                    name="fecha_cobro"
                    defaultValue={hoy}
                    required
                    className={clsEntrada}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className={clsEtiqueta}>Forma de pago</span>
                  <input
                    name="forma_cobro"
                    list="formas-de-cobro"
                    defaultValue={FORMAS_COBRO[0]}
                    className={clsEntrada}
                  />
                  <datalist id="formas-de-cobro">
                    {FORMAS_COBRO.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className={clsEtiqueta}>Notas</span>
                <input name="notas_cobro" className={clsEntrada} />
              </label>

              {estado && "error" in estado && (
                <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
                  {estado.error}
                </p>
              )}
              {estado && "ok" in estado && (
                <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
                  ✓ {estado.ok}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={pendiente || elegidos.length === 0}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
                >
                  {pendiente
                    ? "Guardando…"
                    : `Marcar ${elegidos.length} como cobrado${elegidos.length === 1 ? "" : "s"}`}
                </button>
                <button
                  type="button"
                  onClick={() => setCobrando(false)}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCobrando(true)}
              disabled={elegidos.length === 0}
              className="mt-3 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
            >
              Registrar cobro de {elegidos.length}
            </button>
          )}
        </div>
      )}
    </li>
  );
}
