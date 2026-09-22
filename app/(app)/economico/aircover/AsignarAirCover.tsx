"use client";

import { useState, useTransition } from "react";
import { asignarAirCover } from "../acciones";

type Destino = "mthosting" | "propietario" | "sin_asignar";

const OPCIONES: { valor: Destino; texto: string; activo: string }[] = [
  { valor: "mthosting", texto: "De MTHosting", activo: "border-emerald-600 bg-emerald-950 text-emerald-300" },
  { valor: "propietario", texto: "Del propietario", activo: "border-sky-700 bg-sky-950 text-sky-300" },
  { valor: "sin_asignar", texto: "Sin decidir", activo: "border-amber-600 bg-amber-950/40 text-amber-300" },
];

export default function AsignarAirCover({
  movimientoId,
  actual,
}: {
  movimientoId: string;
  actual: Destino;
}) {
  const [valor, setValor] = useState(actual);
  const [pendiente, comenzar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {OPCIONES.map((o) => (
          <button
            key={o.valor}
            type="button"
            disabled={pendiente}
            onClick={() => {
              const previo = valor;
              setValor(o.valor);
              setError(null);
              comenzar(async () => {
                try {
                  await asignarAirCover(movimientoId, o.valor);
                } catch (e) {
                  // Se vuelve a lo anterior: dejar el botón marcado cuando el
                  // guardado falló haría creer que quedó decidido.
                  setValor(previo);
                  setError(e instanceof Error ? e.message : "No se pudo guardar.");
                }
              });
            }}
            className={`min-h-9 rounded-md border px-3 text-xs font-medium transition-colors disabled:opacity-50 ${
              valor === o.valor
                ? o.activo
                : "border-slate-700 bg-slate-800/40 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
