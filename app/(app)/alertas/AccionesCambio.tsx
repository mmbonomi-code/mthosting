"use client";

import { useActionState, useState } from "react";
import { clsBoton } from "@/lib/ui";
import type { EstadoCambio } from "./acciones";

type Accion = () => Promise<EstadoCambio>;

const clsComun = clsBoton("secundario", "chico");
const clsFuerte = clsBoton("peligro", "chico");

/**
 * Los botones de una marca del calendario.
 *
 * Confirmar una cancelación va en dos pasos: `cancelada` es terminal, no hay
 * vuelta atrás desde el sistema. El resto es un clic.
 */
export default function AccionesCambio({
  codigo,
  confirmar,
  etiquetaConfirmar,
  terminal,
  descartar,
  etiquetaDescartar,
}: {
  codigo: string;
  /** Sin confirmar (cambio de departamento): solo se puede dar por revisado. */
  confirmar?: Accion;
  etiquetaConfirmar?: string;
  /** Pide un segundo clic antes de confirmar. */
  terminal?: boolean;
  descartar: Accion;
  etiquetaDescartar: string;
}) {
  const [estadoConfirmar, enviarConfirmar, confirmando] = useActionState<EstadoCambio>(
    async () => (confirmar ? confirmar() : null),
    null,
  );
  const [estadoDescartar, enviarDescartar, descartando] = useActionState<EstadoCambio>(
    async () => descartar(),
    null,
  );
  const [preguntando, setPreguntando] = useState(false);
  const ocupado = confirmando || descartando;

  const error =
    (estadoConfirmar && "error" in estadoConfirmar && estadoConfirmar.error) ||
    (estadoDescartar && "error" in estadoDescartar && estadoDescartar.error) ||
    null;
  const ok =
    (estadoConfirmar && "ok" in estadoConfirmar && estadoConfirmar.ok) ||
    (estadoDescartar && "ok" in estadoDescartar && estadoDescartar.ok) ||
    null;

  return (
    <div className="flex flex-col items-start gap-1.5 sm:max-w-xs sm:items-end">
      {preguntando ? (
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          <span className="text-xs text-error-text-fuerte">
            ¿Cancelar <span className="font-mono">{codigo}</span>? No se deshace.
          </span>
          <form action={enviarConfirmar}>
            <button type="submit" disabled={ocupado} className={clsFuerte}>
              {confirmando ? "Cancelando…" : "Sí, cancelarla"}
            </button>
          </form>
          <button
            type="button"
            onClick={() => setPreguntando(false)}
            disabled={ocupado}
            className={clsComun}
          >
            No
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
          {confirmar &&
            (terminal ? (
              <button
                type="button"
                onClick={() => setPreguntando(true)}
                disabled={ocupado}
                className={clsFuerte}
              >
                {etiquetaConfirmar}
              </button>
            ) : (
              <form action={enviarConfirmar}>
                <button type="submit" disabled={ocupado} className={clsFuerte}>
                  {confirmando ? "Aplicando…" : etiquetaConfirmar}
                </button>
              </form>
            ))}
          <form action={enviarDescartar}>
            <button type="submit" disabled={ocupado} className={clsComun}>
              {descartando ? "Guardando…" : etiquetaDescartar}
            </button>
          </form>
        </div>
      )}
      {error && (
        <p role="alert" className="text-xs text-error-text sm:text-right">
          {error}
        </p>
      )}
      {ok && <p className="text-xs text-exito-text sm:text-right">{ok}</p>}
    </div>
  );
}
