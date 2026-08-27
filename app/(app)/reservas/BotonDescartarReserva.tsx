"use client";

import { useActionState, useState } from "react";
import type { EstadoFormulario } from "@/lib/reservas/tipos";

/**
 * Descartar una reserva que nunca se concretó, y deshacerlo (§2.10.ter).
 *
 * En dos pasos a propósito: se lleva puestos el check-in, el check-out y la
 * limpieza, así que no puede pasar por un clic distraído. El botón "Cancelar"
 * del formulario, en cambio, solo abandona la edición: por eso este dice
 * "Descartar la reserva".
 *
 * El de recuperar existe porque una reserva descartada desaparece de las
 * listas: si el descarte fue un error, éste es el único camino de vuelta que
 * no depende de que Airbnb la traiga de nuevo en un archivo.
 */
export default function BotonDescartarReserva({
  descartar,
  recuperar,
  descartada,
  codigo,
}: {
  descartar: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  recuperar: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  /** Cómo estaba al abrir la pantalla. */
  descartada: boolean;
  codigo: string;
}) {
  const [estadoDescarte, enviarDescarte, descartando] = useActionState<
    EstadoFormulario,
    FormData
  >(descartar, null);
  const [estadoRecupero, enviarRecupero, recuperando] = useActionState<
    EstadoFormulario,
    FormData
  >(recuperar, null);
  const [confirmando, setConfirmando] = useState(false);

  const avisoDescarte =
    estadoDescarte && "ok" in estadoDescarte ? estadoDescarte.ok : null;
  const avisoRecupero =
    estadoRecupero && "ok" in estadoRecupero ? estadoRecupero.ok : null;
  const estaAfuera = (descartada || avisoDescarte !== null) && avisoRecupero === null;

  const error =
    estadoDescarte && "error" in estadoDescarte
      ? estadoDescarte.error
      : estadoRecupero && "error" in estadoRecupero
        ? estadoRecupero.error
        : null;

  return (
    <div className="flex flex-col gap-3">
      {avisoDescarte && (
        <p className="rounded-lg bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
          ✓ {avisoDescarte}
        </p>
      )}
      {avisoRecupero && (
        <p className="rounded-lg bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
          ✓ {avisoRecupero}
        </p>
      )}

      {estaAfuera ? (
        <form action={enviarRecupero}>
          <button
            type="submit"
            disabled={recuperando}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
          >
            {recuperando ? "Recuperando…" : "Recuperar la reserva"}
          </button>
        </form>
      ) : !confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="self-start rounded-lg border border-red-900 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-950"
        >
          Descartar la reserva
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl border border-red-900 bg-red-950/40 p-4">
          <p className="text-sm text-red-200">
            La reserva <span className="font-mono">{codigo}</span> sale de la
            operación: dejan de figurar su check-in, su check-out y su limpieza.
            No se borra nada. Si más adelante aparece en un archivo de Airbnb,
            vuelve sola con todo.
          </p>
          <div className="flex flex-wrap gap-2">
            <form action={enviarDescarte}>
              <button
                type="submit"
                disabled={descartando}
                className="rounded-lg bg-red-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {descartando ? "Descartando…" : "Sí, descartarla"}
              </button>
            </form>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={descartando}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-60"
            >
              No, dejarla como está
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
