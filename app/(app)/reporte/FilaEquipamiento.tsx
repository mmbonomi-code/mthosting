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
    ? "border-l-error"
    : hayQueLlevarla || hayQueRetirarla
      ? "border-l-accent"
      : equipo.estado === "retirado"
        ? "border-l-primary"
        : "border-l-borde-control";

  const siguiente = SIGUIENTE[equipo.estado];

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
          <fieldset className="flex flex-col gap-1.5">
            <legend className={clsEtiqueta}>Qué es</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <label
                  key={t}
                  className="flex cursor-pointer items-center gap-2 rounded-md border border-borde-control px-3 py-2 text-sm text-tinta transition-colors hover:bg-superficie-alt"
                >
                  <input
                    type="radio"
                    name="tipo"
                    value={t}
                    defaultChecked={equipo.tipo === t}
                    className="size-4 accent-primary"
                  />
                  {ETIQUETA_TIPO[t]}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Colgado de una reserva, el departamento es el de ella: cambiarlo
              acá los dejaría diciendo cosas distintas. */}
          {equipo.reserva_id ? (
            <p className="text-xs text-tinta-tenue">
              Va con la reserva{" "}
              <span className="font-mono text-tinta-suave">{equipo.codigo_reserva}</span>
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
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-tinta-inversa hover:bg-primary-hover disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-md border border-borde-control px-4 py-2 text-sm text-tinta-suave hover:bg-superficie-alt"
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
      className={`flex flex-wrap items-start gap-3 rounded-md border-y border-r border-y-borde border-r-borde border-l-4 bg-superficie px-4 py-3 ${borde} ${
        pendiente ? "opacity-60" : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="font-medium text-tinta">
          {ETIQUETA_TIPO[equipo.tipo]}
          <span className="font-normal text-exito-text">
            {" "}
            · {equipo.depto_codigo ?? "Sin departamento"}
          </span>
        </p>
        <p className="text-sm text-tinta-suave">
          {formatearFechaAR(equipo.fecha_desde)} al{" "}
          {formatearFechaAR(equipo.fecha_hasta)}
          {equipo.huesped_nombre && ` · ${equipo.huesped_nombre}`}
          {equipo.codigo_reserva && (
            <span className="font-mono text-tinta-tenue"> · {equipo.codigo_reserva}</span>
          )}
        </p>
        {equipo.notas && (
          <p className="whitespace-pre-wrap text-sm text-tinta-tenue">{equipo.notas}</p>
        )}
        <p className="mt-0.5 text-xs">
          {atrasada ? (
            <span className="text-error-text">
              Tenía que estar el {formatearFechaAR(equipo.fecha_desde)} y sigue sin
              entregarse
            </span>
          ) : hayQueLlevarla ? (
            <span className="text-aviso-text">Hay que llevarla hoy</span>
          ) : hayQueRetirarla ? (
            <span className="text-aviso-text">Hay que retirarla hoy</span>
          ) : (
            <span className="text-tinta-tenue">
              {ETIQUETA_ESTADO_EQUIPAMIENTO[equipo.estado]}
            </span>
          )}
        </p>
        {estado && "error" in estado && (
          <p role="alert" className="mt-1 text-xs text-error-text">
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
              className="rounded-md border border-borde-control px-3 py-1.5 text-xs text-tinta hover:bg-superficie-alt disabled:opacity-60"
            >
              {ACCION[equipo.estado]}
            </button>
          )}
          <button
            type="button"
            onClick={() => setEditando(true)}
            className="rounded-md border border-borde-control px-3 py-1.5 text-xs text-tinta hover:bg-superficie-alt"
          >
            Editar
          </button>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => iniciar(async () => archivar())}
            className="rounded-md px-2 py-1.5 text-xs text-tinta-tenue hover:bg-superficie-alt hover:text-tinta-suave disabled:opacity-60"
          >
            Archivar
          </button>
        </div>
      )}
    </li>
  );
}
