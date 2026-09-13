"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importarExcelTentativas, type EstadoExcelTentativas } from "./acciones";
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

/**
 * Subir el Excel de tentativas completado (lib/importador/tentativas.ts).
 * Mismo camino que la importación del CSV: se elige, se importa y se ve el
 * resumen.
 */
export default function FormularioExcelTentativas() {
  const [estado, enviar, pendiente] = useActionState<EstadoExcelTentativas, FormData>(
    importarExcelTentativas,
    null,
  );

  return (
    <div className="flex flex-col gap-6">
      <form action={enviar} className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-800/30 p-4">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-300">Excel de tentativas completado</span>
          <input
            type="file"
            name="archivo"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="rounded-lg border border-dashed border-slate-600 bg-slate-800 px-4 py-6 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-900"
          />
          <span className="text-xs text-slate-500">
            El que se descarga en{" "}
            <Link href="/exportar" className="underline hover:text-slate-300">
              Exportar
            </Link>
            . Solo cuentan Estado en Airbnb, nombre, teléfono y huéspedes; una celda vacía no borra
            nada. &quot;Cancelada&quot; cancela solo si el calendario ya la marcó; si todavía la
            muestra, queda para confirmar en Alertas. Si el archivo tiene un error, no se aplica
            nada.
          </span>
        </label>
        <div>
          <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
            {pendiente ? "Importando…" : "Importar Excel"}
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
            Resultado del Excel ({estado.resumen.filas} reservas)
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Contador etiqueta="Datos actualizados" valor={estado.resumen.datosActualizados} />
            <Contador etiqueta="Dejaron de ser tentativas" valor={estado.resumen.dejaronDeSerTentativas} />
            <Contador etiqueta="Sin cambios" valor={estado.resumen.sinCambios} />
            <Contador etiqueta="Canceladas" valor={estado.resumen.canceladas} destacado />
            <Contador etiqueta="A confirmar en Alertas" valor={estado.resumen.aConfirmarEnAlertas} destacado />
            <Contador etiqueta="Siguen en pie" valor={estado.resumen.siguenEnPie} />
          </div>

          {estado.resumen.aConfirmarEnAlertas > 0 && (
            <Link href="/alertas" className="text-sm text-slate-300 underline hover:text-white">
              Confirmar las cancelaciones en Alertas →
            </Link>
          )}

          {estado.resumen.avisos.length > 0 && (
            <div className="rounded-xl border border-amber-900 bg-amber-950/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-amber-300">
                Avisos ({estado.resumen.avisos.length})
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-200/80">
                {estado.resumen.avisos.map((aviso, i) => (
                  <li key={i}>• {aviso}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
