"use client";

import { useActionState, useState, useTransition } from "react";
import { clsAreaTexto, clsEntrada, clsEtiqueta } from "@/lib/ui";
import { formatearFechaAR } from "@/lib/fechas";
import {
  ETIQUETA_ESTADO_EQUIPAMIENTO,
  ETIQUETA_TIPO,
  TIPOS,
  seEntregaEl,
  seRetiraEl,
  type Equipamiento,
  type EstadoEquipamiento,
} from "@/lib/reporte/equipamiento";
import type { EstadoFormulario } from "@/lib/reporte/tipos";

const SIGUIENTE: Partial<Record<EstadoEquipamiento, EstadoEquipamiento>> = {
  pedido: "entregado",
  entregado: "retirado",
};

const ACCION: Partial<Record<EstadoEquipamiento, string>> = {
  pedido: "Marcar entregada",
  entregado: "Marcar retirada",
};

/**
 * Una cuna, silla o bañadera del reporte. Se avanza de estado con un botón y
 * se abre para corregir sin salir de la lista, igual que las notas.
 */
export default function FilaEquipamiento({
  equipo,
  hoy,
  editar,
  cambiarEstado,
  archivar,
  departamentos,
  puedeEscribir,
}: {
  equipo: Equipamiento;
  hoy: string;
  editar: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  cambiarEstado: (estado: EstadoEquipamiento) => Promise<void>;
  archivar: () => Promise<void>;
  departamentos: { id: string; codigo: string }[];
  puedeEscribir: boolean;
}) {
  const [pendiente, iniciar] = useTransition();
  const [editando, setEditando] = useState(false);
  const [estado, enviar, guardando] = useActionState<EstadoFormulario, FormData>(
    editar,
    null,
  );

  const hayQueLlevarla = seEntregaEl(equipo, hoy);
  const hayQueRetirarla = seRetiraEl(equipo, hoy);
  const atrasada = equipo.estado === "pedido" && equipo.fecha_desde < hoy;

  const borde = atrasada
    ? "border-l-red-500"
    : hayQueLlevarla || hayQueRetirarla
      ? "border-l-amber-500"
      : equipo.estado === "retirado"
        ? "border-l-emerald-700"
        : "border-l-slate-700";

  const siguiente = SIGUIENTE[equipo.estado];

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
          <fieldset className="flex flex-col gap-1.5">
            <legend className={clsEtiqueta}>Qué es</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={t}
                    defaultChecked={equipo.tipo === t}
                    className="size-4 accent-white"
                  />
                  {ETIQUETA_TIPO[t]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Colgado de una reserva, el departamento es el de ella: cambiarlo
              acá los dejaría diciendo cosas distintas. */}
          {equipo.reserva_id ? (
            <p className="text-xs text-slate-500">
              Va con la reserva{" "}
              <span className="font-mono text-slate-400">{equipo.codigo_reserva}</span>
              {equipo.depto_codigo && ` · ${equipo.depto_codigo}`}. Para cambiar de
              departamento, archivalo y anotalo de nuevo.
            </p>
          ) : (
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Departamento</span>
              <select
                name="depto_id"
                defaultValue={equipo.depto_id ?? ""}
                className={clsEntrada}
                required
              >
                <option value="">— Elegir —</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.codigo}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Desde</span>
              <input
                type="date"
                name="fecha_desde"
                defaultValue={equipo.fecha_desde}
                className={clsEntrada}
                required
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Hasta</span>
              <input
                type="date"
                name="fecha_hasta"
                defaultValue={equipo.fecha_hasta}
                className={clsEntrada}
                required
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>Notas</span>
            <textarea
              name="notas"
              defaultValue={equipo.notas ?? ""}
              className={clsAreaTexto}
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={guardando}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li
      className={`flex flex-wrap items-start gap-3 rounded-xl border-y border-r border-y-slate-800 border-r-slate-800 border-l-4 bg-slate-800/40 px-4 py-3 ${borde} ${
        pendiente ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-slate-100">
          {ETIQUETA_TIPO[equipo.tipo]}
          <span className="font-normal text-emerald-300">
            {" "}
            · {equipo.depto_codigo ?? "Sin departamento"}
          </span>
        </p>
        <p className="text-sm text-slate-400">
          {formatearFechaAR(equipo.fecha_desde)} al{" "}
          {formatearFechaAR(equipo.fecha_hasta)}
          {equipo.huesped_nombre && ` · ${equipo.huesped_nombre}`}
          {equipo.codigo_reserva && (
            <span className="font-mono text-slate-500"> · {equipo.codigo_reserva}</span>
          )}
        </p>
        {equipo.notas && (
          <p className="whitespace-pre-wrap text-sm text-slate-500">{equipo.notas}</p>
        )}
        <p className="mt-0.5 text-xs">
          {atrasada ? (
            <span className="text-red-300">
              Tenía que estar el {formatearFechaAR(equipo.fecha_desde)} y sigue sin
              entregarse
            </span>
          ) : hayQueLlevarla ? (
            <span className="text-amber-300">Hay que llevarla hoy</span>
          ) : hayQueRetirarla ? (
            <span className="text-amber-300">Hay que retirarla hoy</span>
          ) : (
            <span className="text-slate-500">
              {ETIQUETA_ESTADO_EQUIPAMIENTO[equipo.estado]}
            </span>
          )}
        </p>
        {estado && "error" in estado && (
          <p role="alert" className="mt-1 text-xs text-red-300">
            {estado.error}
          </p>
        )}
      </div>

      {puedeEscribir && (
        <div className="flex shrink-0 flex-wrap gap-2">
          {siguiente && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => iniciar(async () => cambiarEstado(siguiente))}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800 disabled:opacity-60"
            >
              {ACCION[equipo.estado]}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => iniciar(async () => archivar())}
            className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300 disabled:opacity-60"
          >
            Archivar
          </button>
        </div>
      )}
    </li>
  );
}
