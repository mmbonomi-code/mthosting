"use client";

import { useState, useTransition } from "react";
import { clsBoton } from "@/lib/ui";
import { crearArregloDesdeResena, marcarRevisada } from "./acciones";

/** Los botones de una tarjeta de alerta: Crear arreglo y Revisada. */
export default function BotonesAlerta({
  resenaId,
  ofrecerArreglo,
  arregloCreado,
}: {
  resenaId: string;
  ofrecerArreglo: boolean;
  arregloCreado: boolean;
}) {
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [creado, setCreado] = useState(arregloCreado);

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap justify-end gap-2">
        {ofrecerArreglo &&
          (creado ? (
            <span className="inline-flex h-11 items-center text-sm text-exito-text sm:h-9">Arreglo creado ✓</span>
          ) : (
            <button
              type="button"
              disabled={pendiente}
              className={clsBoton("secundario", "chico")}
              onClick={() =>
                empezar(async () => {
                  const r = await crearArregloDesdeResena(resenaId);
                  if (r.ok) setCreado(true);
                  else setError(r.error);
                })
              }
            >
              Crear arreglo
            </button>
          ))}
        <button
          type="button"
          disabled={pendiente}
          className={clsBoton("secundario", "chico")}
          onClick={() =>
            empezar(async () => {
              const r = await marcarRevisada(resenaId);
              if (!r.ok) setError(r.error);
            })
          }
        >
          {pendiente ? "…" : "Revisada"}
        </button>
      </div>
      {error && <p className="text-sm text-error-text">{error}</p>}
    </div>
  );
}
