"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoFormulario } from "./acciones";
import {
  clsAreaTexto,
  clsBotonPrimario,
  clsBotonSecundario,
  clsEntrada,
  clsEtiqueta,
} from "@/lib/ui";

type Valores = {
  nombre?: string | null;
  contacto?: string | null;
  fecha_nacimiento?: string | null;
  cuenta_cobro?: string | null;
  datos_bancarios?: string | null;
  activo?: boolean;
};

export default function FormularioPropietario({
  accion,
  valores = {},
  urlCancelar,
}: {
  accion: (
    estadoPrevio: EstadoFormulario,
    fd: FormData,
  ) => Promise<EstadoFormulario>;
  valores?: Valores;
  urlCancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Nombre *</span>
        <input
          name="nombre"
          required
          defaultValue={valores.nombre ?? ""}
          className={clsEntrada}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Contacto (teléfono o email)</span>
        <input
          name="contacto"
          defaultValue={valores.contacto ?? ""}
          className={clsEntrada}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Fecha de nacimiento</span>
        <input
          name="fecha_nacimiento"
          type="date"
          defaultValue={valores.fecha_nacimiento ?? ""}
          className={clsEntrada}
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Cuenta de cobro</span>
        <input
          name="cuenta_cobro"
          defaultValue={valores.cuenta_cobro ?? ""}
          className={clsEntrada}
        />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={clsEtiqueta}>Datos bancarios</span>
        <textarea
          name="datos_bancarios"
          defaultValue={valores.datos_bancarios ?? ""}
          className={clsAreaTexto}
        />
      </label>
      <label className="flex items-center gap-3 py-1 sm:col-span-2">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={valores.activo ?? true}
          className="size-5 accent-white"
        />
        <span className="text-base text-slate-200">Activo</span>
      </label>

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
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <Link
          href={urlCancelar}
          className={`${clsBotonSecundario} flex items-center`}
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
