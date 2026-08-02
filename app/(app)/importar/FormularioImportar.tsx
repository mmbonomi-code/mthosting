"use client";

import { useActionState } from "react";
import { importarLote, type EstadoImportacion } from "./acciones";
import { clsBotonPrimario } from "@/lib/ui";

function Contador({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: number; destacado?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-800 px-4 py-3">
      <div className={`text-2xl font-semibold ${destacado && valor > 0 ? "text-amber-300" : "text-white"}`}>
        {valor}
      </div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</div>
    </div>
  );
}

export default function FormularioImportar() {
  const [estado, enviar, pendiente] = useActionState<EstadoImportacion, FormData>(
    importarLote,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={enviar} className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-800/30 p-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-300">
            Archivos CSV de reservas de Airbnb
          </span>
          <input
            type="file"
            name="archivos"
            accept=".csv,text/csv"
            multiple
            required
            className="rounded-lg border border-dashed border-slate-600 bg-slate-800 px-4 py-6 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900"
          />
          <span className="text-xs text-slate-500">
            Se pueden subir varios a la vez: se ordenan por la fecha del nombre
            y, si una reserva aparece en más de uno, gana el más reciente. Si un
            archivo está dañado, no se importa nada de nada.
          </span>
        </label>
        <div>
          <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
            {pendiente ? "Importando…" : "Importar"}
          </button>
        </div>
      </form>

      {estado?.resultado === "error" && (
        <div role="alert" className="rounded-xl bg-red-950 px-4 py-3 text-sm text-red-300">
          <p className="font-semibold">No se importó nada.</p>
          <p className="mt-1 whitespace-pre-wrap">{estado.error}</p>
        </div>
      )}

      {estado?.resultado === "ok" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-white">
            Resultado del lote ({estado.resumen.archivos}{" "}
            {estado.resumen.archivos === 1 ? "archivo" : "archivos"},{" "}
            {estado.resumen.filas_total} reservas)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Contador etiqueta="Nuevas" valor={estado.resumen.nuevas} />
            <Contador etiqueta="Actualizadas" valor={estado.resumen.actualizadas} />
            <Contador etiqueta="Sin cambios" valor={estado.resumen.sin_cambios} />
            <Contador etiqueta="Sin departamento" valor={estado.resumen.sin_asignar} destacado />
            <Contador etiqueta="Canceladas nuevas" valor={estado.resumen.canceladas_detectadas} destacado />
            <Contador etiqueta="Reaparecidas" valor={estado.resumen.descartadas_reaparecidas} destacado />
          </div>

          {estado.resumen.anomalias.length > 0 && (
            <div className="rounded-xl border border-amber-900 bg-amber-950/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-amber-300">
                Anomalías ({estado.resumen.anomalias.length})
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-200/80">
                {estado.resumen.anomalias.map((anomalia, i) => (
                  <li key={i}>• {anomalia}</li>
                ))}
              </ul>
            </div>
          )}

          {estado.resumen.advertencias.length > 0 && (
            <div className="rounded-xl border border-slate-700 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-300">Advertencias</h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-400">
                {estado.resumen.advertencias.map((advertencia, i) => (
                  <li key={i}>• {advertencia}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
