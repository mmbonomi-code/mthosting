"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoFormulario } from "./acciones";
import {
  clsBotonPrimario,
  clsBotonSecundario,
  clsEntrada,
  clsEtiqueta,
} from "@/lib/ui";

const MODALIDADES: Record<string, string> = {
  por_limpieza: "Por limpieza",
  sueldo_mensual: "Sueldo mensual",
  ambas: "Ambas",
};

const ROLES: Record<string, string> = {
  admin: "Administración",
  manager: "Manager",
  gobernanta: "Gobernanta",
  coordinador: "Coordinación",
  limpieza: "Limpieza",
  propietario: "Propietario",
};

type Valores = {
  nombre?: string | null;
  telefono?: string | null;
  hace_limpieza?: boolean;
  hace_checkin?: boolean;
  es_backoffice?: boolean;
  modalidad_pago?: string | null;
  rol?: string | null;
  activo?: boolean;
};

export default function FormularioPersona({
  accion,
  valores = {},
  urlCancelar,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
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
        <span className={clsEtiqueta}>Teléfono</span>
        <input
          name="telefono"
          type="tel"
          defaultValue={valores.telefono ?? ""}
          className={clsEntrada}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Rol en el sistema</span>
        <select name="rol" defaultValue={valores.rol ?? ""} className={clsEntrada}>
          <option value="">— Sin acceso a la app —</option>
          {Object.entries(ROLES).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Modalidad de pago</span>
        <select
          name="modalidad_pago"
          defaultValue={valores.modalidad_pago ?? ""}
          className={clsEntrada}
        >
          <option value="">— Sin definir —</option>
          {Object.entries(MODALIDADES).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1 sm:col-span-2">
        <legend className={`${clsEtiqueta} mb-1`}>Qué hace</legend>
        {[
          // "Back office" salió de acá: era lo mismo que el rol coordinador
          // y tener las dos formas de decirlo confundía. Lo dice el rol.
          { nombre: "hace_limpieza", etiqueta: "Hace limpiezas", valor: valores.hace_limpieza },
          { nombre: "hace_checkin", etiqueta: "Hace check-in / check-out", valor: valores.hace_checkin },
        ].map((campo) => (
          <label key={campo.nombre} className="flex items-center gap-3 py-1">
            <input
              type="checkbox"
              name={campo.nombre}
              defaultChecked={campo.valor ?? false}
              className="size-5 accent-primary"
            />
            <span className="text-base text-tinta">{campo.etiqueta}</span>
          </label>
        ))}
      </fieldset>

      <label className="flex items-center gap-3 py-1 sm:col-span-2">
        <input
          type="checkbox"
          name="activo"
          defaultChecked={valores.activo ?? true}
          className="size-5 accent-primary"
        />
        <span className="text-base text-tinta">
          Activa (al desactivar sale de los desplegables; el histórico queda)
        </span>
      </label>

      {estado?.error && (
        <p
          role="alert"
          className="rounded-md bg-error-soft px-4 py-3 text-sm text-error-text sm:col-span-2"
        >
          {estado.error}
        </p>
      )}

      <div className="flex gap-3 sm:col-span-2">
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <Link href={urlCancelar} className={`${clsBotonSecundario} flex items-center`}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
