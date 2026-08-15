"use client";

import { useActionState, useState, useTransition } from "react";
import { formatearFechaAR } from "@/lib/fechas";
import {
  BORDE_PLAZO,
  estadoDePlazo,
  textoDePlazo,
  TEXTO_PLAZO,
  type Nota,
} from "@/lib/reporte/notas";
import CamposNota from "./CamposNota";
import type { EstadoFormulario } from "@/lib/reporte/tipos";

/**
 * Una línea del reporte. Se marca hecha con la casilla —no hay que borrar el
 * renglón, que era el problema del cuadro de texto— y se abre para editar sin
 * salir de la lista.
 */
export default function FilaNota({
  nota,
  hoy,
  editar,
  alternar,
  archivar,
  departamentos,
  personas,
  puedeEscribir,
}: {
  nota: Nota;
  hoy: string;
  editar: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  alternar: (hecho: boolean) => Promise<void>;
  archivar: () => Promise<void>;
  departamentos: { id: string; codigo: string }[];
  personas: { id: string; nombre: string }[];
  puedeEscribir: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [marcando, iniciar] = useTransition();
  const [hecho, setHecho] = useState(nota.estado === "hecho");
  const [estado, enviar, guardando] = useActionState<EstadoFormulario, FormData>(
    editar,
    null,
  );

  const plazo = estadoDePlazo({ ...nota, estado: hecho ? "hecho" : "pendiente" }, hoy);

  const fechas =
    nota.fecha === null
      ? null
      : nota.fecha_hasta && nota.fecha_hasta !== nota.fecha
        ? `${formatearFechaAR(nota.fecha)} al ${formatearFechaAR(nota.fecha_hasta)}`
        : formatearFechaAR(nota.fecha);

  if (editando) {
    return (
      <li>
        <form
          action={(fd) => {
            enviar(fd);
            setEditando(false);
          }}
          className="flex flex-col gap-3 rounded-md border border-borde-fuerte bg-superficie p-4"
        >
          <CamposNota
            seccion={nota.seccion}
            valores={{
              titulo: nota.titulo,
              detalle: nota.detalle ?? "",
              fecha: nota.fecha ?? "",
              fecha_hasta: nota.fecha_hasta ?? "",
              depto_id: nota.depto_id ?? "",
              responsable_id: nota.responsable_id ?? "",
            }}
            departamentos={departamentos}
            personas={personas}
          />
          {estado && "error" in estado && (
            <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
              {estado.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-tinta-inversa hover:bg-primary-hover disabled:opacity-60"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-md border border-borde-control px-4 py-2 text-sm text-tinta-suave hover:bg-superficie-alt"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => archivar()}
              className="ml-auto rounded-md px-3 py-2 text-sm text-tinta-tenue hover:bg-superficie-alt hover:text-tinta-suave"
            >
              Archivar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`flex items-start gap-3 rounded-md border-y border-r border-y-borde border-r-borde border-l-4 bg-superficie px-4 py-3 ${
        BORDE_PLAZO[plazo]
      } ${marcando ? "opacity-60" : ""}`}
    >
      {puedeEscribir && (
        <input
          type="checkbox"
          checked={hecho}
          disabled={marcando}
          aria-label={hecho ? "Volver a pendiente" : "Marcar hecho"}
          onChange={(e) => {
            const valor = e.target.checked;
            setHecho(valor);
            iniciar(async () => alternar(valor));
          }}
          className="mt-1 size-5 shrink-0 accent-primary"
        />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`font-medium ${hecho ? "text-tinta-tenue line-through" : "text-tinta"}`}
        >
          {nota.titulo}
        </p>
        {nota.detalle && (
          <p className="whitespace-pre-wrap text-sm text-tinta-suave">{nota.detalle}</p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          <span className={TEXTO_PLAZO[plazo]}>
            {textoDePlazo({ ...nota, estado: hecho ? "hecho" : "pendiente" }, hoy)}
          </span>
          {fechas && <span className="text-tinta-tenue">· {fechas}</span>}
          {nota.depto_codigo && (
            <span className="text-exito-text">· {nota.depto_codigo}</span>
          )}
          {nota.responsable_nombre && (
            <span className="text-tinta-suave">· {nota.responsable_nombre}</span>
          )}
        </p>
      </div>

      {puedeEscribir && (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="shrink-0 rounded-md border border-borde-control px-2.5 py-1 text-xs text-tinta-suave hover:bg-superficie-alt"
        >
          Editar
        </button>
      )}
    </li>
  );
}
