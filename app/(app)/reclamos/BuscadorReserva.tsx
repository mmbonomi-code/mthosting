"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { clsEntrada } from "@/lib/ui";
import { formatearFechaAR } from "@/lib/fechas";
import type { ReservaEncontrada } from "@/lib/reclamos/storage";
import { buscarReservas } from "./acciones";

/**
 * "Cargar reclamo": se busca la reserva por código o por huésped. Si esa
 * reserva ya tiene un reclamo, lleva al existente en vez de crear otro —es
 * un reclamo por reserva— y lo dice antes de que la persona haga clic.
 */
export default function BuscadorReserva() {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ReservaEncontrada[]>([]);
  const [buscando, iniciar] = useTransition();

  const buscar = (valor: string) => {
    setQ(valor);
    iniciar(async () => setResultados(await buscarReservas(valor)));
  };

  const cerrar = () => {
    setAbierto(false);
    setQ("");
    setResultados([]);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200"
      >
        + Cargar reclamo
      </button>

      {abierto && (
        <div
          className="fixed inset-0 z-20 flex items-start justify-center bg-slate-950/70 p-4 pt-20"
          onClick={cerrar}
        >
          <div
            className="flex w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-800 px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Buscar reserva
              </h2>
            </div>

            <div className="p-4">
              <input
                autoFocus
                type="search"
                value={q}
                onChange={(e) => buscar(e.target.value)}
                placeholder="Código de reserva o nombre del huésped"
                className={`${clsEntrada} w-full`}
              />
            </div>

            <div className="max-h-80 overflow-y-auto">
              {q.trim().length < 2 ? (
                <p className="px-4 pb-4 text-sm text-slate-500">
                  Escribí al menos dos letras.
                </p>
              ) : buscando ? (
                <p className="px-4 pb-4 text-sm text-slate-500">Buscando…</p>
              ) : resultados.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-slate-500">
                  Ninguna reserva coincide. Probá con el código completo.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {resultados.map((r) => (
                    <li key={r.id} className="border-t border-slate-800">
                      <button
                        type="button"
                        onClick={() => {
                          cerrar();
                          router.push(
                            r.reclamo_id
                              ? `/reclamos/${r.reclamo_id}`
                              : `/reclamos/nuevo?reserva=${r.id}`,
                          );
                        }}
                        className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-800"
                      >
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-slate-100">
                            {r.huesped_nombre ?? "Sin nombre"}
                          </span>
                          <span className="font-mono text-sm text-slate-400">
                            {r.codigo_reserva}
                          </span>
                          {r.reclamo_id && (
                            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-300">
                              ya tiene reclamo
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-slate-500">
                          {r.depto ?? "Sin departamento"}
                          {r.fecha_checkin && r.fecha_checkout && (
                            <>
                              {" · "}
                              {formatearFechaAR(r.fecha_checkin)} →{" "}
                              {formatearFechaAR(r.fecha_checkout)}
                            </>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-800 px-4 py-3">
              <button
                type="button"
                onClick={cerrar}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
