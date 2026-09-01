"use client";

import { useActionState, useTransition } from "react";
import { comprimirImagen } from "@/lib/limpiezas/comprimir";
import { usePendientes } from "./PendientesProvider";
import type { EstadoFormulario } from "./tipos";
import { clsAreaTexto, clsEntrada, clsEtiqueta } from "@/lib/ui";

/**
 * El cierre de la limpieza: reportar un arreglo, dejar la observación para
 * la próxima, cargar el viático, y marcar como terminada. Agrupado porque es
 * lo último que se hace, en ese orden.
 *
 * Los dos campos de texto van por la cola de envío: si no hay señal se
 * guardan igual y salen cuando vuelve. El arreglo, el comprobante y el
 * cierre NO: son acciones puntuales con confirmación en pantalla, y encolar
 * un "terminé" que en realidad no llegó sería peor que avisar que falló.
 */
export default function AlTerminar({
  limpiezaId,
  observacionInicial,
  viaticoInicial,
  crearArreglo,
  subirComprobanteViatico,
  finalizarLimpieza,
  puedeFinalizar,
  monedaMonto,
}: {
  limpiezaId: string;
  observacionInicial: string;
  viaticoInicial: string;
  crearArreglo: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  subirComprobanteViatico: (
    estadoPrevio: EstadoFormulario,
    fd: FormData,
  ) => Promise<EstadoFormulario>;
  finalizarLimpieza: (estadoPrevio: EstadoFormulario) => Promise<EstadoFormulario>;
  puedeFinalizar: boolean;
  monedaMonto: string;
}) {
  const [, guardarObs] = useTransition();
  const [, guardarMonto] = useTransition();
  const { registrar } = usePendientes();
  const [estadoArreglo, enviarArreglo, pendienteArreglo] = useActionState<
    EstadoFormulario,
    FormData
  >(crearArreglo, null);
  const [estadoComprobante, enviarComprobante, pendienteComprobante] = useActionState<
    EstadoFormulario,
    FormData
  >(subirComprobanteViatico, null);
  const [estadoFinal, enviarFinal, pendienteFinal] = useActionState<EstadoFormulario, FormData>(
    finalizarLimpieza,
    null,
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-slate-700 bg-slate-800/40 p-4">
      <h2 className="font-medium text-white">Al terminar</h2>

      <form action={enviarArreglo} className="flex flex-col gap-2">
        <span className={clsEtiqueta}>
          Algo para arreglar o informar
          <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-slate-500">
            Va a administración: roturas, cosas que no funcionan.
          </span>
        </span>
        <textarea
          name="descripcion"
          placeholder="Ej: la persiana del dormitorio no cierra bien…"
          className={clsAreaTexto}
        />
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={pendienteArreglo}
            className="h-10 shrink-0 rounded-lg border border-slate-700 px-4 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700 disabled:opacity-60"
          >
            {pendienteArreglo ? "Reportando…" : "Reportar"}
          </button>
          {estadoArreglo && "ok" in estadoArreglo && (
            <span className="text-sm text-emerald-400">✓ {estadoArreglo.ok}</span>
          )}
          {estadoArreglo && "error" in estadoArreglo && (
            <span className="text-sm text-red-400">{estadoArreglo.error}</span>
          )}
        </div>
      </form>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>
          Observación para la próxima limpieza
          <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-slate-500">
            Le queda a quien limpie este depto la próxima vez: qué faltó llevar, qué encontró raro.
          </span>
        </span>
        <textarea
          name="observacion_proxima"
          defaultValue={observacionInicial}
          placeholder="Ej: faltaron toallones y jabón líquido, llevar de más…"
          className={clsAreaTexto}
          onBlur={(e) => {
            const valor = e.target.value;
            guardarObs(async () => {
              await registrar({
                clase: "texto",
                limpiezaId,
                campo: "observacion_proxima",
                valor,
              });
            });
          }}
        />
      </label>

      <div className="flex flex-col gap-2">
        <span className={clsEtiqueta}>Viático (si gastaste en algo)</span>
        <div className="flex items-center gap-2">
          <span className="text-slate-400">{monedaMonto}</span>
          <input
            type="text"
            inputMode="decimal"
            defaultValue={viaticoInicial}
            placeholder="0"
            className={`${clsEntrada} w-32`}
            onBlur={(e) => {
              const valor = e.target.value;
              guardarMonto(async () => {
                await registrar({
                  clase: "texto",
                  limpiezaId,
                  campo: "viatico_monto",
                  valor,
                });
              });
            }}
          />
          <label className="flex h-11 cursor-pointer items-center rounded-lg border border-slate-700 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-700">
            {pendienteComprobante ? "Subiendo…" : "📷 Comprobante"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={(e) => {
                const archivo = e.target.files?.[0];
                if (!archivo) return;
                e.target.value = "";
                // Se achica en el teléfono, igual que las fotos (spec §2.7).
                comprimirImagen(archivo).then((listo) => {
                  const fd = new FormData();
                  fd.append("comprobante", listo);
                  enviarComprobante(fd);
                });
              }}
            />
          </label>
        </div>
        {estadoComprobante && "ok" in estadoComprobante && (
          <span className="text-sm text-emerald-400">✓ {estadoComprobante.ok}</span>
        )}
        {estadoComprobante && "error" in estadoComprobante && (
          <span className="text-sm text-red-400">{estadoComprobante.error}</span>
        )}
      </div>

      <form action={enviarFinal} className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={pendienteFinal}
          className="h-12 rounded-lg bg-white px-5 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendienteFinal ? "Guardando…" : "Marcar como terminada"}
        </button>
        {!puedeFinalizar && (
          <p className="text-center text-xs text-slate-500">
            Hace falta al menos una foto del departamento terminado.
          </p>
        )}
        {estadoFinal && "error" in estadoFinal && (
          <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-center text-sm text-red-300">
            {estadoFinal.error}
          </p>
        )}
      </form>
    </section>
  );
}
