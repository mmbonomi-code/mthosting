"use client";

import { useState, useTransition } from "react";
import { clsEntrada, clsEtiqueta } from "@/lib/ui";
import { ESTADOS_FINALES, transicionesDe } from "@/lib/reclamos/estados";
import type { EstadoReclamo } from "@/lib/reclamos/plazos";
import type { EstadoFormulario } from "@/lib/reclamos/storage";

const ETIQUETA_ACCION: Record<EstadoReclamo, string> = {
  borrador: "Volver a borrador",
  por_presentar: "Marcar listo para presentar",
  presentado: "Marcar como presentado",
  escalado: "Escalar a AirCover",
  cobrado: "Registrar cobro",
  rechazado: "Marcar rechazado",
  descartado: "Descartar reclamo",
};

/** Las que abren un diálogo antes de confirmar, porque piden un dato. */
const PIDEN_DATO: ReadonlySet<EstadoReclamo> = new Set(["presentado", "cobrado"]);

export default function AccionesEstado({
  estado,
  urlAirbnb,
  montoReclamado,
  cambiar,
  reabrir,
  esAdmin,
}: {
  estado: EstadoReclamo;
  urlAirbnb: string;
  montoReclamado: number | null;
  cambiar: (destino: EstadoReclamo, fd: FormData) => Promise<EstadoFormulario>;
  reabrir: () => Promise<EstadoFormulario>;
  esAdmin: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dialogo, setDialogo] = useState<EstadoReclamo | null>(null);

  const ejecutar = (destino: EstadoReclamo, fd: FormData) => {
    iniciar(async () => {
      const resultado = await cambiar(destino, fd);
      setError(resultado && "error" in resultado ? resultado.error : null);
      if (!resultado || !("error" in resultado)) setDialogo(null);
    });
  };

  const destinos = transicionesDe(estado);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-borde bg-superficie p-4">
      {ESTADOS_FINALES.has(estado) ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-tinta-suave">
            Este reclamo está cerrado. No se puede editar.
          </p>
          {esAdmin && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() =>
                iniciar(async () => {
                  const r = await reabrir();
                  setError(r && "error" in r ? r.error : null);
                })
              }
              className="rounded-md border border-borde-control px-3 py-1.5 text-sm text-tinta-suave hover:bg-superficie-alt disabled:opacity-60"
            >
              Reabrir como borrador
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {destinos.map((destino, i) => {
            const esPrincipal = i === 0;
            const esDescarte = destino === "descartado";

            if (PIDEN_DATO.has(destino)) {
              return (
                <button
                  key={destino}
                  type="button"
                  disabled={pendiente}
                  onClick={() => setDialogo(destino)}
                  className={
                    esPrincipal
                      ? "rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover disabled:opacity-60"
                      : "rounded-md border border-borde-control px-4 py-2.5 text-sm text-tinta transition-colors hover:bg-superficie-alt disabled:opacity-60"
                  }
                >
                  {ETIQUETA_ACCION[destino]}
                </button>
              );
            }

            return (
              <button
                key={destino}
                type="button"
                disabled={pendiente}
                onClick={() => ejecutar(destino, new FormData())}
                className={
                  esPrincipal
                    ? "rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover disabled:opacity-60"
                    : esDescarte
                      ? "rounded-md px-4 py-2.5 text-sm text-tinta-suave transition-colors hover:bg-superficie-alt hover:text-tinta disabled:opacity-60"
                      : "rounded-md border border-borde-control px-4 py-2.5 text-sm text-tinta transition-colors hover:bg-superficie-alt disabled:opacity-60"
                }
              >
                {ETIQUETA_ACCION[destino]}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
          {error}
        </p>
      )}

      {dialogo && (
        <div
          className="fixed inset-0 z-20 flex items-start justify-center bg-fondo p-4 pt-24"
          onClick={() => setDialogo(null)}
        >
          <form
            onClick={(e) => e.stopPropagation()}
            action={(fd) => ejecutar(dialogo, fd)}
            className="flex w-full max-w-md flex-col gap-4 rounded-md border border-borde-control bg-fondo p-4"
          >
            <h2 className="font-medium text-tinta">{ETIQUETA_ACCION[dialogo]}</h2>

            {dialogo === "presentado" ? (
              <label className="flex flex-col gap-1.5">
                <span className={clsEtiqueta}>Link del caso en Airbnb</span>
                <input
                  autoFocus
                  type="url"
                  name="url_airbnb"
                  defaultValue={urlAirbnb}
                  placeholder="https://www.airbnb.com/resolutions/…"
                  className={clsEntrada}
                />
                <span className="text-xs text-tinta-tenue">
                  Es opcional: podés presentarlo ahora y pegar el link después.
                </span>
              </label>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className={clsEtiqueta}>¿Cuánto se cobró? (USD)</span>
                <input
                  autoFocus
                  type="text"
                  inputMode="decimal"
                  name="monto_cobrado"
                  defaultValue={montoReclamado ?? ""}
                  className={clsEntrada}
                />
                <span className="text-xs text-tinta-tenue">
                  Puede ser menos de lo reclamado. Si no se cobró nada, cerralo como
                  rechazado.
                </span>
              </label>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDialogo(null)}
                className="rounded-md border border-borde-control px-3 py-2 text-sm text-tinta-suave hover:bg-superficie-alt"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pendiente}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-tinta-inversa hover:bg-primary-hover disabled:opacity-60"
              >
                {pendiente ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
