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
          className="flex flex-col gap-3 rounded-xl border border-slate-600 bg-slate-800/60 p-4"
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
            <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
              {estado.error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
            >
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => archivar()}
              className="ml-auto rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-800 hover:text-slate-300"
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
      className={`flex items-start gap-3 rounded-xl border-y border-r border-y-slate-800 border-r-slate-800 border-l-4 bg-slate-800/40 px-4 py-3 ${
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
          className="mt-1 size-5 shrink-0 accent-emerald-500"
        />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`font-medium ${hecho ? "text-slate-500 line-through" : "text-slate-100"}`}
        >
          {nota.titulo}
        </p>
        {nota.detalle && (
          <p className="whitespace-pre-wrap text-sm text-slate-400">{nota.detalle}</p>
        )}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
          <span className={TEXTO_PLAZO[plazo]}>
            {textoDePlazo({ ...nota, estado: hecho ? "hecho" : "pendiente" }, hoy)}
          </span>
          {fechas && <span className="text-slate-500">· {fechas}</span>}
          {nota.depto_codigo && (
            <span className="text-emerald-300">· {nota.depto_codigo}</span>
          )}
          {nota.responsable_nombre && (
            <span className="text-slate-400">· {nota.responsable_nombre}</span>
          )}
        </p>
      </div>

      {puedeEscribir && (
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
        >
          Editar
        </button>
      )}
    </li>
  );
}
