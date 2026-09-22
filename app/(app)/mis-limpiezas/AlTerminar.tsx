"use client";

import { useActionState, useTransition } from "react";
import { comprimirImagen } from "@/lib/limpiezas/comprimir";
import { usePendientes } from "./PendientesProvider";
import type { EstadoFormulario } from "./tipos";
import { clsAreaTexto, clsEntrada, clsEtiqueta, clsBoton } from "@/lib/ui";

/**
 * El cierre de la limpieza: dejar la observación para la próxima, cargar el
 * viático, y marcar como terminada. Agrupado porque es lo último que se
 * hace, en ese orden.
 *
 * "Algo para arreglar" ya NO vive acá: se mudó abajo de sus fotos
 * (ReportarArreglo.tsx), que es donde la persona lo busca.
 *
 * Los dos campos de texto van por la cola de envío: si no hay señal se
 * guardan igual y salen cuando vuelve. El comprobante y el cierre NO: son
 * acciones puntuales con confirmación en pantalla, y encolar un "terminé"
 * que en realidad no llegó sería peor que avisar que falló.
 */
export default function AlTerminar({
  limpiezaId,
  observacionInicial,
  viaticoInicial,
  subirComprobanteViatico,
  finalizarLimpieza,
  puedeFinalizar,
  monedaMonto,
}: {
  limpiezaId: string;
  observacionInicial: string;
  viaticoInicial: string;
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
  const [estadoComprobante, enviarComprobante, pendienteComprobante] = useActionState<
    EstadoFormulario,
    FormData
  >(subirComprobanteViatico, null);
  const [estadoFinal, enviarFinal, pendienteFinal] = useActionState<EstadoFormulario, FormData>(
    finalizarLimpieza,
    null,
  );

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-borde-control bg-superficie p-4">
      <h2 className="font-medium text-tinta">Al terminar</h2>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>
          Observación para la próxima limpieza
          <span className="mt-0.5 block text-xs font-normal normal-case tracking-normal text-tinta-etiqueta">
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
          <span className="text-tinta-tenue">{monedaMonto}</span>
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
          <label className="flex h-11 cursor-pointer items-center rounded-lg border border-borde-control px-3 text-sm text-tinta-suave transition-colors hover:bg-elevada-hover">
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
          <span className="text-sm text-exito-text">✓ {estadoComprobante.ok}</span>
        )}
        {estadoComprobante && "error" in estadoComprobante && (
          <span className="text-sm text-error-text">{estadoComprobante.error}</span>
        )}
      </div>

      <form action={enviarFinal} className="flex flex-col gap-2">
        <button
          type="submit"
          disabled={pendienteFinal}
          className={clsBoton("primario", "grande")}
        >
          {pendienteFinal ? "Guardando…" : "Marcar como terminada"}
        </button>
        {!puedeFinalizar && (
          <p className="text-center text-xs text-tinta-etiqueta">
            Hace falta al menos una foto del departamento terminado.
          </p>
        )}
        {estadoFinal && "error" in estadoFinal && (
          <p role="alert" className="rounded-lg bg-error-soft px-3 py-2 text-center text-sm text-error-text">
            {estadoFinal.error}
          </p>
        )}
      </form>
    </section>
  );
}
