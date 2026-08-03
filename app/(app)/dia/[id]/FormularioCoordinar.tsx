"use client";

import { useActionState, useState } from "react";
import type { EstadoFormulario } from "../acciones";
import SelectorHora from "@/app/componentes/SelectorHora";
import { clsAreaTexto, clsBotonPrimario, clsEntrada, clsEtiqueta } from "@/lib/ui";

export type OpcionAcceso = {
  valor: string;
  etiqueta: string;
  grupo: "Sin persona" | "Personas";
  metodo?: string;
  instrucciones?: string | null;
};

/**
 * Selector unificado de acceso (spec §3.1): UN solo campo que lista puntos
 * de acceso y personas juntos, agrupados. Guarda uno u otro, nunca los dos.
 */
export default function FormularioCoordinar({
  accion,
  opciones,
  valores,
  avisoSelf,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  opciones: OpcionAcceso[];
  valores: {
    acceso: string;
    fecha_coordinada: string;
    hora_coordinada: string;
    observaciones: string;
    fechaReserva: string;
  };
  /** Texto que explica cómo funciona el self en este departamento. */
  avisoSelf: string | null;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );
  const [acceso, setAcceso] = useState(valores.acceso);
  // Por defecto se propone la fecha de la reserva: es lo que se confirma en
  // la mayoría de los casos.
  const [fecha, setFecha] = useState(valores.fecha_coordinada || valores.fechaReserva);

  const sinPersona = opciones.filter((o) => o.grupo === "Sin persona");
  const personas = opciones.filter((o) => o.grupo === "Personas");
  const elegida = opciones.find((o) => o.valor === acceso);
  const esSelf = elegida?.metodo === "self";
  const fechaDistinta = fecha !== "" && fecha !== valores.fechaReserva;

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Acceso</span>
        <select
          name="acceso"
          value={acceso}
          onChange={(e) => setAcceso(e.target.value)}
          className={clsEntrada}
        >
          <option value="">— Sin definir —</option>
          {sinPersona.length > 0 && (
            <optgroup label="Sin persona">
              {sinPersona.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </optgroup>
          )}
          {personas.length > 0 && (
            <optgroup label="Personas">
              {personas.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.etiqueta}
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </label>

      {/* Las instrucciones del punto elegido, para leérselas al huésped. */}
      {elegida?.instrucciones && (
        <p className="whitespace-pre-wrap rounded-lg bg-slate-800/60 px-3 py-2 text-sm text-slate-300">
          {elegida.instrucciones}
        </p>
      )}

      {esSelf && avisoSelf && (
        <div className="rounded-lg bg-amber-950/50 px-3 py-2 text-sm text-amber-200">
          {avisoSelf}
          <label className="mt-2 flex items-center gap-2">
            <input type="checkbox" name="confirmar_self" className="size-4 accent-amber-400" />
            <span className="text-xs">Confirmo igual</span>
          </label>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Fecha coordinada</span>
          <input
            type="date"
            name="fecha_coordinada"
            value={fecha}
            onChange={(e) => setFecha(e.target.value)}
            className={clsEntrada}
          />
          {fechaDistinta && (
            <span className="text-xs text-sky-300">
              Distinta a la de la reserva. La limpieza no se mueve.
            </span>
          )}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Hora coordinada</span>
          <SelectorHora name="hora_coordinada" defaultValue={valores.hora_coordinada} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Observaciones</span>
        <textarea
          name="observaciones"
          defaultValue={valores.observaciones}
          className={clsAreaTexto}
        />
      </label>

      {estado && "error" in estado && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {estado.error}
        </p>
      )}

      <div>
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Guardando…" : "Guardar coordinación"}
        </button>
      </div>
    </form>
  );
}
