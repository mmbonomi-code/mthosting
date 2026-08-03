"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoFormulario } from "../acciones";
import { PAGO_POR_TIPO, TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import SelectorHora from "@/app/componentes/SelectorHora";
import {
  clsAreaTexto,
  clsBotonPrimario,
  clsBotonSecundario,
  clsEntrada,
  clsEtiqueta,
} from "@/lib/ui";

export type DeptoOpcion = { id: string; codigo: string; nombre_interno: string };

export default function FormularioNuevaLimpieza({
  accion,
  departamentos,
  fechaPorDefecto,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  departamentos: DeptoOpcion[];
  fechaPorDefecto: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={clsEtiqueta}>Departamento *</span>
        <select name="depto_id" required defaultValue="" className={clsEntrada}>
          <option value="" disabled>
            Elegí el departamento…
          </option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo} — {d.nombre_interno}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Fecha *</span>
        <input
          type="date"
          name="fecha"
          required
          defaultValue={fechaPorDefecto}
          className={clsEntrada}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Tipo de limpieza</span>
        <select name="tipo" defaultValue="normal" className={clsEntrada}>
          {Object.entries(TIPOS_LIMPIEZA).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
              {PAGO_POR_TIPO[valor] ? ` — se paga ${PAGO_POR_TIPO[valor]}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Hora (opcional)</span>
        <SelectorHora name="hora_checkout" />
      </label>
      <div />

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={clsEtiqueta}>Notas</span>
        <textarea name="notas" className={clsAreaTexto} />
      </label>

      <p className="text-xs text-slate-500 sm:col-span-2">
        Si ese día hay un huésped alojado, la limpieza queda vinculada a su
        reserva automáticamente.
      </p>

      {estado?.error && (
        <p
          role="alert"
          className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300 sm:col-span-2"
        >
          {estado.error}
        </p>
      )}

      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Creando…" : "Crear limpieza"}
        </button>
        <Link href="/limpiezas" className={`${clsBotonSecundario} flex items-center`}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
