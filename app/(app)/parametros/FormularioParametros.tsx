"use client";

import { useActionState } from "react";
import type { EstadoFormulario } from "./acciones";
import SelectorHora from "@/app/componentes/SelectorHora";
import { clsBotonPrimario, clsEntrada, clsEtiqueta } from "@/lib/ui";

const DIAS = [
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
  "domingo",
];

export default function FormularioParametros({
  accion,
  valores,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  valores: Record<string, string>;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <label className="flex flex-col gap-1.5 sm:max-w-56">
        <span className={clsEtiqueta}>Hora límite de check-out</span>
        <SelectorHora
          name="hora_limite_checkout"
          defaultValue={valores.hora_limite_checkout}
        />
        <span className="text-xs text-tinta-tenue">
          Pasada esta hora, una salida deja poco tiempo para limpiar: el sistema
          avisa al coordinarla.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 sm:max-w-56">
        <span className={clsEtiqueta}>Hora mínima de check-in</span>
        <SelectorHora
          name="hora_minima_checkin"
          defaultValue={valores.hora_minima_checkin}
        />
        <span className="text-xs text-tinta-tenue">
          Si alguien entra antes de esta hora el mismo día que otro sale tarde,
          la ventana es materialmente imposible y se alerta.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Día de corte de la semana de pago</span>
        <select
          name="dia_corte_semana_pago"
          defaultValue={valores.dia_corte_semana_pago ?? "viernes"}
          className={`${clsEntrada} sm:w-48`}
        >
          {DIAS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <span className="text-xs text-tinta-tenue">
          Las limpiezas se pagan una vez por semana: se paga lo realizado entre
          el corte anterior y el día previo al siguiente.
        </span>
      </label>

      {estado && "error" in estado && (
        <p role="alert" className="rounded-md bg-error-soft px-4 py-3 text-sm text-error-text">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-md bg-exito-soft px-4 py-3 text-sm text-exito-text">
          ✓ Guardado.
        </p>
      )}

      <div>
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
