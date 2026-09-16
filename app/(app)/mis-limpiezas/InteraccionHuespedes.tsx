import { formatearFechaAR } from "@/lib/fechas";
import type { Interaccion } from "@/lib/limpiezas/interaccion";

/**
 * Cuándo sale el huésped, cuándo entra el próximo, y si la limpieza tiene que
 * recibir llaves, valijas o al huésped en persona. Va en la tarjeta de la
 * lista y en el detalle: es lo primero que hay que saber antes de salir.
 */
export default function InteraccionHuespedes({ interaccion }: { interaccion: Interaccion }) {
  const { salida, entrada } = interaccion;
  if (!salida && !entrada) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 text-sm tabular-nums">
        {salida ? (
          <div className="rounded-lg bg-slate-900/60 px-3 py-1.5">
            <p className="text-xs text-slate-400">
              {salida.otroDia ? `Salió el ${formatearFechaAR(salida.otroDia).slice(0, 5)}` : "Sale"}
            </p>
            <p className="font-medium text-slate-200">{salida.hora}</p>
          </div>
        ) : (
          <div />
        )}
        {entrada && (
          <div className="rounded-lg bg-orange-950 px-3 py-1.5">
            <p className="text-xs text-orange-300">Entra ese día</p>
            <p className="font-semibold text-orange-200">{entrada.hora}</p>
          </div>
        )}
      </div>
      {salida?.dejaLlaves && (
        <p className="rounded-lg bg-sky-950/60 px-3 py-2 text-sm text-sky-200">
          🔑 El huésped que sale te deja las llaves.
        </p>
      )}
      {entrada?.aviso === "valijas" && (
        <p className="rounded-lg bg-sky-950/60 px-3 py-2 text-sm text-sky-200">
          🧳 El huésped que entra deja las valijas en el depto con vos.
        </p>
      )}
      {entrada?.aviso === "en_persona" && (
        <p className="rounded-lg bg-sky-950/60 px-3 py-2 text-sm text-sky-200">
          🙋 Recibís en persona al huésped que entra.
        </p>
      )}
    </div>
  );
}
