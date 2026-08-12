"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { clsAreaTexto, clsEntrada, clsEtiqueta } from "@/lib/ui";
import type { EstadoFormulario } from "@/lib/caja/tipos";

export type ValoresMovimiento = {
  fecha: string;
  tipo: "ingreso" | "egreso";
  monto: string;
  categoria_id: string;
  depto_id: string;
  descripcion: string;
  reembolsable: boolean;
};

/**
 * Alta y edición de un movimiento. El monto va siempre positivo: el signo lo
 * da si es ingreso o egreso, no un menos escrito a mano.
 */
export default function FormularioMovimiento({
  accion,
  valores,
  categorias,
  departamentos,
  esAlta,
  urlCancelar,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  valores: ValoresMovimiento;
  categorias: { id: string; nombre: string }[];
  departamentos: { id: string; codigo: string }[];
  esAlta: boolean;
  urlCancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );
  const [tipo, setTipo] = useState(valores.tipo);
  const [depto, setDepto] = useState(valores.depto_id);
  const [reembolsable, setReembolsable] = useState(valores.reembolsable);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <fieldset className="flex gap-2">
        <legend className={`${clsEtiqueta} mb-1.5`}>Tipo</legend>
        {(["egreso", "ingreso"] as const).map((t) => (
          <label
            key={t}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              tipo === t
                ? t === "ingreso"
                  ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
                  : "border-slate-400 bg-slate-800 text-white"
                : "border-slate-700 text-slate-400 hover:bg-slate-800/60"
            }`}
          >
            <input
              type="radio"
              name="tipo"
              value={t}
              checked={tipo === t}
              onChange={() => setTipo(t)}
              className="sr-only"
            />
            {t === "ingreso" ? "Ingreso (entra plata)" : "Egreso (sale plata)"}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Fecha</span>
          <input
            type="date"
            name="fecha"
            defaultValue={valores.fecha}
            required
            className={clsEntrada}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Monto (pesos)</span>
          <input
            type="text"
            inputMode="decimal"
            name="monto"
            defaultValue={valores.monto}
            required
            placeholder="367600"
            className={clsEntrada}
          />
          <span className="text-xs text-slate-500">
            Siempre positivo. El signo lo da si entra o sale.
          </span>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Categoría</span>
        <select
          name="categoria_id"
          defaultValue={valores.categoria_id}
          required
          className={clsEntrada}
        >
          <option value="">— Elegir —</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Detalle</span>
        <textarea
          name="descripcion"
          defaultValue={valores.descripcion}
          className={clsAreaTexto}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Departamento</span>
        <select
          name="depto_id"
          value={depto}
          onChange={(e) => {
            setDepto(e.target.value);
            if (e.target.value === "") setReembolsable(false);
          }}
          className={clsEntrada}
        >
          <option value="">— Ninguno: es un gasto general —</option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo}
            </option>
          ))}
        </select>
      </label>

      {/* El reembolso solo tiene sentido si hay a quién cobrárselo. */}
      {depto !== "" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 px-3 py-2.5 transition-colors hover:bg-slate-800/60">
          <input
            type="checkbox"
            name="reembolsable"
            checked={reembolsable}
            onChange={(e) => setReembolsable(e.target.checked)}
            className="mt-0.5 size-5 accent-amber-400"
          />
          <span>
            <span className="block text-base text-slate-100">
              Lo reembolsa el propietario
            </span>
            <span className="block text-xs text-slate-500">
              Queda pendiente de cobro hasta que lo marques cobrado.
            </span>
          </span>
        </label>
      )}

      {estado && "error" in estado && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-lg bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
          ✓ {estado.ok}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : esAlta ? "Guardar movimiento" : "Guardar cambios"}
        </button>
        <Link
          href={urlCancelar}
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
