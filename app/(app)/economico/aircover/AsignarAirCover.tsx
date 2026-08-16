"use client";

import { useState, useTransition } from "react";
import { asignarAirCover } from "../acciones";

type Destino = "mthosting" | "propietario" | "sin_asignar";

const OPCIONES: { valor: Destino; texto: string; activo: string }[] = [
  { valor: "mthosting", texto: "De MTHosting", activo: "border-primary bg-primary-soft text-primary-soft-text" },
  { valor: "propietario", texto: "Del propietario", activo: "border-dato bg-dato-soft text-dato-text" },
  { valor: "sin_asignar", texto: "Sin decidir", activo: "border-accent bg-accent-soft text-accent-soft-text" },
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
                : "border-borde-control bg-superficie text-tinta-suave hover:bg-superficie-hover"
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-error-text">{error}</p>}
    </div>
  );
}
