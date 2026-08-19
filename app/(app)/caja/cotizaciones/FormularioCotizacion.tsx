"use client";

import { useActionState, useRef, useState } from "react";
import { clsEntrada, clsEtiqueta } from "@/lib/ui";
import { formatearFechaAR } from "@/lib/fechas";
import type { EstadoFormulario } from "@/lib/caja/tipos";

type Pendiente = { fecha: string; cantidad: number };

export default function FormularioCotizacion({
  hoy,
  pendientes,
  accion,
}: {
  hoy: string;
  /** Días con movimientos que esperan su tipo de cambio, del más nuevo al más viejo. */
  pendientes: Pendiente[];
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );
  const tcRef = useRef<HTMLInputElement>(null);

  // Arranca en el pendiente más nuevo si hay alguno: es lo que Marcos va a
  // querer cargar primero. Los dos campos van controlados para poder
  // vaciarlos solos después de guardar, igual que en "+ Movimiento".
  const [campos, setCampos] = useState({ fecha: pendientes[0]?.fecha ?? hoy, tc: "" });

  // Tras guardar una cotización, `pendientes` llega actualizado por props
  // (revalidatePath ya sacó ese día de la lista): se salta sola al próximo
  // pendiente, así se puede cargar uno detrás de otro. Comparar durante el
  // render, no en un efecto, evita el parpadeo de un render de más.
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (estado && "ok" in estado) {
      setCampos({ fecha: pendientes[0]?.fecha ?? hoy, tc: "" });
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {pendientes.length > 0 && (
        <section className="rounded-xl border border-amber-900/60 bg-amber-950/30 p-4">
          <h2 className="text-sm font-medium text-amber-200">
            {pendientes.length} día{pendientes.length === 1 ? "" : "s"} con movimientos
            sin cotización
          </h2>
          <p className="mt-0.5 text-xs text-amber-400/80">
            Tocá una fecha para cargarla abajo. Al guardar se completan solos todos los
            movimientos de ese día que la estaban esperando.
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {pendientes.slice(0, 60).map((p) => (
              <li key={p.fecha}>
                <button
                  type="button"
                  onClick={() => {
                    setCampos((c) => ({ ...c, fecha: p.fecha }));
                    tcRef.current?.focus();
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs tabular-nums transition-colors ${
                    campos.fecha === p.fecha
                      ? "border-amber-400 bg-amber-900/60 text-amber-100"
                      : "border-amber-900/60 text-amber-300 hover:bg-amber-950/50"
                  }`}
                >
                  {formatearFechaAR(p.fecha)}
                  <span className="ml-1 text-amber-400/80">
                    · {p.cantidad} mov.{p.cantidad === 1 ? "" : "s"}
                  </span>
                </button>
              </li>
            ))}
            {pendientes.length > 60 && (
              <li className="px-1 py-1.5 text-xs text-amber-400/80">
                y {pendientes.length - 60} más
              </li>
            )}
          </ul>
        </section>
      )}

      <form
        action={enviar}
        className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>Fecha</span>
            <input
              type="date"
              name="fecha"
              value={campos.fecha}
              onChange={(e) => setCampos((c) => ({ ...c, fecha: e.target.value }))}
              required
              className={clsEntrada}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>Cotización</span>
            <input
              ref={tcRef}
              type="text"
              inputMode="decimal"
              name="tc"
              value={campos.tc}
              onChange={(e) => setCampos((c) => ({ ...c, tc: e.target.value }))}
              required
              placeholder="1445"
              className={clsEntrada}
            />
          </label>
        </div>

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

        <div>
          <button
            type="submit"
            disabled={pendiente}
            className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
