"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "../acciones";
import { PAGO_POR_TIPO, TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import { clsAreaTexto, clsBotonPrimario, clsEntrada, clsEtiqueta } from "@/lib/ui";

export type PersonaOpcion = { id: string; nombre: string };

export function FormularioAsignar({
  accion,
  personas,
  asignadoA,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  personas: PersonaOpcion[];
  asignadoA: string | null;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          name="asignado_a"
          defaultValue={asignadoA ?? ""}
          className={clsEntrada}
          aria-label="Responsable"
        >
          <option value="">— Sin responsable —</option>
          {personas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pendiente}
          className="h-11 shrink-0 rounded-lg bg-white px-5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Asignar"}
        </button>
      </div>
      {personas.length === 0 && (
        <p className="text-xs text-amber-400">
          No hay personas que hagan limpieza cargadas. Se agregan en Personas.
        </p>
      )}
      {estado?.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      )}
    </form>
  );
}

export function FormularioEditar({
  accion,
  valores,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  valores: {
    fecha: string;
    tipo: string;
    hora_checkout: string | null;
    notas: string | null;
  };
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Tipo de limpieza</span>
        <select name="tipo" defaultValue={valores.tipo} className={clsEntrada}>
          {Object.entries(TIPOS_LIMPIEZA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
              {PAGO_POR_TIPO[valor] ? ` — se paga ${PAGO_POR_TIPO[valor]}` : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Fecha</span>
        <input
          type="date"
          name="fecha"
          required
          defaultValue={valores.fecha}
          className={clsEntrada}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Hora de salida del huésped</span>
        <input
          type="time"
          name="hora_checkout"
          step={300}
          defaultValue={valores.hora_checkout?.slice(0, 5) ?? ""}
          className={clsEntrada}
        />
      </label>
      <div />
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={clsEtiqueta}>Notas</span>
        <textarea
          name="notas"
          defaultValue={valores.notas ?? ""}
          className={clsAreaTexto}
        />
      </label>

      {estado?.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300 sm:col-span-2"
        >
          {estado.error}
        </p>
      )}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
