"use client";

import { useTransition } from "react";
import { formatearFechaAR } from "@/lib/fechas";
import {
  ETIQUETA_ESTADO_EQUIPAMIENTO,
  ETIQUETA_TIPO,
  seEntregaEl,
  seRetiraEl,
  type Equipamiento,
  type EstadoEquipamiento,
} from "@/lib/reporte/equipamiento";

const SIGUIENTE: Partial<Record<EstadoEquipamiento, EstadoEquipamiento>> = {
  pedido: "entregado",
  entregado: "retirado",
};

const ACCION: Partial<Record<EstadoEquipamiento, string>> = {
  pedido: "Marcar entregada",
  entregado: "Marcar retirada",
};

export default function FilaEquipamiento({
  equipo,
  hoy,
  cambiarEstado,
  archivar,
  puedeEscribir,
}: {
  equipo: Equipamiento;
  hoy: string;
  cambiarEstado: (estado: EstadoEquipamiento) => Promise<void>;
  archivar: () => Promise<void>;
  puedeEscribir: boolean;
}) {
  const [pendiente, iniciar] = useTransition();

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
