"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./acciones";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import { clsBotonPrimario, clsEntrada, clsEtiqueta } from "@/lib/ui";

const AMBIENTES = ["monoambiente", "dos", "tres", "cuatro"] as const;

export type DeptoOpcion = { id: string; codigo: string; nombre_interno: string };

export function FormularioJuegoTarifas({
  accion,
  vigentes,
  hoy,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  vigentes: Record<string, number>;
  hoy: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Rigen desde *</span>
          <input
            type="date"
            name="vigente_desde"
            required
            defaultValue={hoy}
            className={clsEntrada}
          />
          <span className="text-xs text-slate-500">
            Toda limpieza de esa fecha en adelante toma estos valores.
          </span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Moneda</span>
          <select name="moneda" defaultValue="ARS" className={clsEntrada}>
            <option value="ARS">Pesos (ARS)</option>
            <option value="USD">Dólares (USD)</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {AMBIENTES.map((ambientes) => (
          <label key={ambientes} className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>{ETIQUETA_AMBIENTES[ambientes]}</span>
            <input
              type="number"
              name={`monto_${ambientes}`}
              min={0}
              step="0.01"
              defaultValue={vigentes[ambientes] ?? ""}
              placeholder="Dejar vacío para no cambiarlo"
              className={clsEntrada}
            />
          </label>
        ))}
      </div>

      {estado?.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {estado.error}
        </p>
      )}

      <div>
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Guardando…" : "Cargar valores"}
        </button>
      </div>
    </form>
  );
}

export function FormularioTarifaDepto({
  accion,
  departamentos,
  hoy,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  departamentos: DeptoOpcion[];
  hoy: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select name="depto_id" required defaultValue="" className={clsEntrada}>
          <option value="" disabled>
            Departamento…
          </option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo} — {d.nombre_interno}
            </option>
          ))}
        </select>
        <input
          type="number"
          name="monto"
          min={0}
          step="0.01"
          required
          placeholder="Monto"
          className={`${clsEntrada} sm:w-40`}
        />
        <select name="moneda" defaultValue="ARS" className={`${clsEntrada} sm:w-32`}>
          <option value="ARS">ARS</option>
          <option value="USD">USD</option>
        </select>
        <input
          type="date"
          name="vigente_desde"
          required
          defaultValue={hoy}
          className={`${clsEntrada} sm:w-44`}
        />
        <button
          type="submit"
          disabled={pendiente}
          className="h-11 shrink-0 rounded-lg bg-white px-4 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Agregar"}
        </button>
      </div>
      {estado?.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      )}
    </form>
  );
}
