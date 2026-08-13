"use client";

import { useState, useTransition } from "react";
import { clsEntrada } from "@/lib/ui";
import { mapearAnuncioEconomico } from "../acciones";

export default function VincularAnuncio({
  anuncio,
  departamentos,
}: {
  anuncio: string;
  departamentos: { id: string; codigo: string; nombre_interno: string }[];
}) {
  const [pendiente, comenzar] = useTransition();
  const [listo, setListo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (listo) {
    return (
      <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
        ✓ Vinculado. Se reimputó todo lo que ya estaba cargado de este anuncio, sin
        reimportar nada.
      </p>
    );
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const deptoId = String(new FormData(e.currentTarget).get("depto_id") ?? "");
        if (!deptoId) return;
        setError(null);
        comenzar(async () => {
          try {
            await mapearAnuncioEconomico(anuncio, deptoId);
            setListo(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo vincular.");
          }
        });
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          name="depto_id"
          required
          defaultValue=""
          className={clsEntrada}
          aria-label={`Departamento para ${anuncio}`}
        >
          <option value="" disabled>
            Elegí a qué departamento corresponde…
          </option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo} — {d.nombre_interno}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pendiente}
          className="h-11 shrink-0 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Vinculando…" : "Vincular"}
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
