"use client";

import { useState, useTransition } from "react";
import { clsBoton } from "@/lib/ui";
import { TONO_TAREA } from "@/lib/estados";
import Badge from "@/app/componentes/Badge";
import type { Resultado } from "./acciones";

/**
 * Una tarea de logística que se marca con un toque: "Dejé lo blanco",
 * "Llevar cuna"… Pendiente es un botón grande; hecha es una pastilla verde
 * con la hora y un "Deshacer" chico, porque en la calle un toque equivocado
 * pasa seguido y no puede quedar para siempre.
 */
export default function Tarea({
  hecha,
  textoPendiente,
  textoHecha,
  detalleHecha,
  bloqueada,
  motivoBloqueo,
  alMarcar,
}: {
  hecha: boolean;
  textoPendiente: string;
  textoHecha: string;
  /** "10:42", quién, etc. Va al lado de la pastilla. */
  detalleHecha?: string | null;
  bloqueada?: boolean;
  motivoBloqueo?: string;
  alMarcar: (valor: boolean) => Promise<Resultado>;
}) {
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const cambiar = (valor: boolean) =>
    iniciar(async () => {
      setError(null);
      const r = await alMarcar(valor);
      if (r?.error) setError(r.error);
    });

  return (
    <div className="flex flex-col gap-1">
      {hecha ? (
        <div className="flex min-h-11 flex-wrap items-center gap-2">
          <Badge tono={TONO_TAREA.hecha}>✓ {textoHecha}</Badge>
          {detalleHecha && (
            <span className="text-xs tabular-nums text-tinta-etiqueta">{detalleHecha}</span>
          )}
          <button
            type="button"
            onClick={() => cambiar(false)}
            disabled={enviando}
            className={clsBoton("discreto", "chico")}
          >
            {enviando ? "Guardando…" : "Deshacer"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => cambiar(true)}
          disabled={enviando || bloqueada}
          title={bloqueada ? motivoBloqueo : undefined}
          className={`${clsBoton("secundario", "normal")} w-full justify-start`}
        >
          <span aria-hidden className="size-2 rounded-full bg-aviso" />
          {enviando ? "Guardando…" : textoPendiente}
        </button>
      )}
      {bloqueada && !hecha && motivoBloqueo && (
        <p className="text-xs text-tinta-etiqueta">{motivoBloqueo}</p>
      )}
      {error && <p className="text-sm text-error-text">{error}</p>}
    </div>
  );
}
