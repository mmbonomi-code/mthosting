"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { EstadoFormulario } from "./acciones";
import { METODOS_ACCESO } from "@/lib/eventos/etiquetas";
import {
  clsAreaTexto,
  clsBotonPrimario,
  clsBotonSecundario,
  clsEntrada,
  clsEtiqueta,
} from "@/lib/ui";

type Valores = {
  metodo?: string | null;
  ubicacion?: string | null;
  identificador?: string | null;
  instrucciones?: string | null;
  sirve_checkin?: boolean;
  sirve_checkout?: boolean;
  recibe_limpieza?: boolean;
  activo?: boolean;
};

export default function FormularioPuntoAcceso({
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
        <span className={clsEtiqueta}>Método</span>
        <select name="metodo" defaultValue={valores.metodo ?? "sobre"} className={clsEntrada}>
          {Object.entries(METODOS_ACCESO).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Ubicación *</span>
        <input
          name="ubicacion"
          required
          defaultValue={valores.ubicacion ?? ""}
          placeholder="Talcahuano, Esmeralda, Kennedy 3…"
          className={clsEntrada}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Identificador</span>
        <input
          name="identificador"
          defaultValue={valores.identificador ?? ""}
          placeholder="#2906, #1080…"
          className={clsEntrada}
        />
      </label>
      <div />

      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <span className={clsEtiqueta}>Instrucciones</span>
        <textarea
          name="instrucciones"
          defaultValue={valores.instrucciones ?? ""}
          placeholder="Se muestran en la ficha de la reserva, tal como las va a leer quien coordina."
          className={clsAreaTexto}
        />
      </label>

      <fieldset className="flex flex-col gap-1 sm:col-span-2">
        <legend className={`${clsEtiqueta} mb-1`}>Sirve para</legend>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            name="sirve_checkin"
            defaultChecked={valores.sirve_checkin ?? true}
            className="size-5 accent-white"
          />
          <span className="text-base text-slate-200">Check-in (entrada)</span>
        </label>
        <label className="flex items-center gap-3 py-1">
          <input
            type="checkbox"
            name="sirve_checkout"
            defaultChecked={valores.sirve_checkout ?? true}
            className="size-5 accent-white"
          />
          <span className="text-base text-slate-200">Check-out (salida)</span>
        </label>
      </fieldset>

      <label className="flex items-start gap-3 py-1 sm:col-span-2">
        <input
          type="checkbox"
          name="recibe_limpieza"
          defaultChecked={valores.recibe_limpieza ?? false}
          className="mt-0.5 size-5 accent-white"
        />
        <span className="text-base text-slate-200">
          Acá las valijas las recibe la limpieza
          <span className="block text-sm text-slate-400">
            Se les avisa en su pantalla. Si las valijas quedan en un lugar del
            edificio o en la oficina, dejalo sin tildar: a la limpieza no le
            cambia nada.
          </span>
        </span>
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
        <Link href={urlCancelar} className={`${clsBotonSecundario} flex items-center`}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}
