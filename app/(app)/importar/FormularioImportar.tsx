"use client";

import { useActionState } from "react";
import { importarLote, type EstadoImportacion } from "./acciones";
import { clsBotonPrimario } from "@/lib/ui";

function Contador({ etiqueta, valor, destacado = false }: { etiqueta: string; valor: number; destacado?: boolean }) {
  return (
    <div className="rounded-md border border-borde px-4 py-3">
      <div className={`text-2xl font-semibold ${destacado && valor > 0 ? "text-aviso-text" : "text-tinta"}`}>
        {valor}
      </div>
      <div className="text-xs uppercase tracking-wide text-tinta-tenue">{etiqueta}</div>
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
      <form action={enviar} className="flex flex-col gap-4 rounded-md border border-borde bg-superficie p-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-tinta-suave">
            Archivos CSV de reservas de Airbnb
          </span>
          <input
            type="file"
            name="archivos"
            accept=".csv,text/csv"
            multiple
            required
            className="rounded-md border border-dashed border-borde-fuerte bg-superficie-alt px-4 py-6 text-sm text-tinta-suave file:mr-4 file:rounded-md file:border-0 file:bg-superficie file:px-4 file:py-2 file:text-sm file:font-semibold file:text-tinta"
          />
          <span className="text-xs text-tinta-tenue">
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
        <div role="alert" className="rounded-md bg-error-soft px-4 py-3 text-sm text-error-text">
          <p className="font-semibold">No se importó nada.</p>
          <p className="mt-1 whitespace-pre-wrap">{estado.error}</p>
        </div>
      )}

      {estado?.resultado === "ok" && (
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-tinta">
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

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-tinta-tenue">
              Limpiezas
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <Contador etiqueta="Generadas" valor={estado.resumen.limpiezas_generadas} />
              <Contador etiqueta="Movidas de fecha" valor={estado.resumen.limpiezas_movidas} destacado />
              <Contador etiqueta="Canceladas" valor={estado.resumen.limpiezas_canceladas} destacado />
            </div>
          </div>

          {estado.resumen.anomalias.length > 0 && (
            <div className="rounded-md border border-aviso bg-aviso-soft/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-aviso-text">
                Anomalías ({estado.resumen.anomalias.length})
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-aviso-text/80">
                {estado.resumen.anomalias.map((anomalia, i) => (
                  <li key={i}>• {anomalia}</li>
                ))}
              </ul>
            </div>
          )}

          {estado.resumen.advertencias.length > 0 && (
            <div className="rounded-md border border-borde-control px-4 py-3">
              <h3 className="text-sm font-semibold text-tinta-suave">Advertencias</h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-tinta-suave">
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
