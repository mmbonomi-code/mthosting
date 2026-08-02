"use client";

import { useTransition } from "react";

/**
 * Casilla que guarda sola al tocarla. Se usa para los pendientes de la
 * llegada y para el late check-out: en la calle nadie quiere apretar
 * "guardar" después de tildar algo.
 */
export default function Interruptor({
  etiqueta,
  detalle,
  activo,
  accion,
  color = "normal",
}: {
  etiqueta: string;
  detalle?: string;
  activo: boolean;
  accion: (valor: boolean) => Promise<void>;
  color?: "normal" | "alerta";
}) {
  const [pendiente, iniciar] = useTransition();

  return (
    <label
      className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
        activo
          ? color === "alerta"
            ? "border-amber-800 bg-amber-950/40"
            : "border-emerald-800 bg-emerald-950/30"
          : "border-slate-800 hover:bg-slate-800/50"
      } ${pendiente ? "opacity-60" : ""}`}
    >
      <input
        type="checkbox"
        checked={activo}
        disabled={pendiente}
        onChange={(e) => {
          const valor = e.target.checked;
          iniciar(async () => {
            await accion(valor);
          });
        }}
        className="size-5 shrink-0 accent-white"
      />
      <span className="min-w-0">
        <span className="block text-base text-slate-100">{etiqueta}</span>
        {detalle && <span className="block text-xs text-slate-400">{detalle}</span>}
      </span>
    </label>
  );
}
