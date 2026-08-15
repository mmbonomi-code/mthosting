"use client";

import { useState } from "react";
import { ETIQUETA_TIPO_BANO } from "@/lib/etiquetas";
import { clsEntrada } from "@/lib/ui";

export type BanoCargado = { tipo: string; detalle: string | null };

/** Lista dinámica de baños: se agregan los que haga falta, cada uno con su tipo. */
export default function CamposBanos({
  iniciales = [],
}: {
  iniciales?: BanoCargado[];
}) {
  const [banos, setBanos] = useState<BanoCargado[]>(iniciales);

  return (
    <div className="flex flex-col gap-3 sm:col-span-2">
      {banos.length === 0 && (
        <p className="text-sm text-tinta-tenue">
          Este departamento todavía no tiene baños cargados.
        </p>
      )}

      {banos.map((bano, indice) => (
        <div key={indice} className="flex flex-col gap-2 sm:flex-row">
          <select
            name="bano_tipo"
            defaultValue={bano.tipo}
            className={`${clsEntrada} sm:w-56`}
          >
            {Object.entries(ETIQUETA_TIPO_BANO).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
          <input
            name="bano_detalle"
            defaultValue={bano.detalle ?? ""}
            placeholder="Detalle (opcional)"
            className={clsEntrada}
          />
          <button
            type="button"
            onClick={() =>
              setBanos((previos) => previos.filter((_, i) => i !== indice))
            }
            className="h-11 shrink-0 rounded-md border border-borde-control px-4 text-sm text-tinta-suave transition-colors hover:bg-superficie-alt"
          >
            Quitar
          </button>
        </div>
      ))}

      <div>
        <button
          type="button"
          onClick={() =>
            setBanos((previos) => [
              ...previos,
              { tipo: "completo_ducha", detalle: "" },
            ])
          }
          className="h-11 rounded-md border border-borde-control px-4 text-sm font-medium text-tinta-suave transition-colors hover:bg-superficie-alt"
        >
          + Agregar baño
        </button>
      </div>

      <p className="text-xs text-tinta-tenue">
        La cantidad de baños se cuenta sola, según cuántos agregues.
      </p>
    </div>
  );
}
