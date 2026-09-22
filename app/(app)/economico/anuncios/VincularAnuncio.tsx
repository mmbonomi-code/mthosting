"use client";

import { useState, useTransition } from "react";
import { clsEntrada, clsBoton } from "@/lib/ui";
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
      <p className="rounded-lg bg-exito-soft px-3 py-2 text-sm text-exito-text">
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
          className={`${clsBoton("primario")} shrink-0`}
        >
          {pendiente ? "Vinculando…" : "Vincular"}
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-sm text-error-text">
          {error}
        </p>
      )}
    </form>
  );
}
