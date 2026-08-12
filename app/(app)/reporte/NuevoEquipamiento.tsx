"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { clsAreaTexto, clsEntrada, clsEtiqueta } from "@/lib/ui";
import { formatearFechaAR } from "@/lib/fechas";
import { ETIQUETA_TIPO, TIPOS } from "@/lib/reporte/equipamiento";
import type { EstadoFormulario } from "@/lib/reporte/tipos";
import {
  buscarReservasParaEquipamiento,
  type ReservaParaEquipamiento,
} from "./acciones";

/**
 * Alta de una cuna, silla o bañadera.
 *
 * Se puede colgar de una reserva —y entonces el departamento y las fechas
 * salen de ella, que es lo que pidió el dueño— o cargarse suelta, para lo que
 * no corresponde a ninguna reserva puntual.
 */
export default function NuevoEquipamiento({
  accion,
  departamentos,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  departamentos: { id: string; codigo: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [modo, setModo] = useState<"reserva" | "suelto">("reserva");
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<ReservaParaEquipamiento[]>([]);
  const [elegida, setElegida] = useState<ReservaParaEquipamiento | null>(null);
  const [buscando, iniciarBusqueda] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  const buscar = (valor: string) => {
    setQ(valor);
    iniciarBusqueda(async () =>
      setResultados(await buscarReservasParaEquipamiento(valor)),
    );
  };

  const limpiar = () => {
    setElegida(null);
    setQ("");
    setResultados([]);
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200"
      >
        + Anotar cuna, silla o bañadera
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={enviar}
      className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4"
    >
      <fieldset className="flex flex-col gap-1.5">
        <legend className={clsEtiqueta}>Qué se pidió</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t, i) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-200 transition-colors hover:bg-slate-800"
            >
              <input
                type="radio"
                name="tipo"
                value={t}
                defaultChecked={i === 0}
                className="size-4 accent-white"
              />
              {ETIQUETA_TIPO[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2 border-t border-slate-700 pt-3">
        <button
          type="button"
          onClick={() => setModo("reserva")}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            modo === "reserva"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          Para una reserva
        </button>
        <button
          type="button"
          onClick={() => {
            setModo("suelto");
            limpiar();
          }}
          className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
            modo === "suelto"
              ? "bg-slate-700 text-white"
              : "text-slate-400 hover:bg-slate-800"
          }`}
        >
          Suelto
        </button>
      </div>

      {modo === "reserva" ? (
        elegida ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-900/60 px-3 py-2.5">
            <span>
              <span className="block text-sm text-slate-100">
                {elegida.huesped_nombre ?? "Sin nombre"}{" "}
                <span className="font-mono text-slate-400">{elegida.codigo_reserva}</span>
              </span>
              <span className="block text-xs text-slate-500">
                {elegida.depto ?? "Sin departamento"}
                {elegida.fecha_checkin && elegida.fecha_checkout && (
                  <>
                    {" · "}
                    {formatearFechaAR(elegida.fecha_checkin)} al{" "}
                    {formatearFechaAR(elegida.fecha_checkout)}
                  </>
                )}
              </span>
            </span>
            <button
              type="button"
              onClick={limpiar}
              className="text-xs text-slate-400 underline decoration-slate-600 underline-offset-4 hover:text-white"
            >
              Cambiar
            </button>
            <input type="hidden" name="reserva_id" value={elegida.id} />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Buscar la reserva</span>
              <input
                type="search"
                value={q}
                onChange={(e) => buscar(e.target.value)}
                placeholder="Código o nombre del huésped"
                className={clsEntrada}
              />
            </label>
            {q.trim().length >= 2 && (
              <ul className="flex flex-col overflow-hidden rounded-lg border border-slate-700">
                {buscando ? (
                  <li className="px-3 py-2 text-sm text-slate-500">Buscando…</li>
                ) : resultados.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-slate-500">
                    Ninguna reserva coincide.
                  </li>
                ) : (
                  resultados.map((r) => (
                    <li key={r.id} className="border-b border-slate-800 last:border-0">
                      <button
                        type="button"
                        onClick={() => setElegida(r)}
                        className="w-full px-3 py-2 text-left transition-colors hover:bg-slate-800"
                      >
                        <span className="block text-sm text-slate-100">
                          {r.huesped_nombre ?? "Sin nombre"}{" "}
                          <span className="font-mono text-slate-400">
                            {r.codigo_reserva}
                          </span>
                        </span>
                        <span className="block text-xs text-slate-500">
                          {r.depto ?? "Sin departamento"}
                          {r.fecha_checkin && ` · entra ${formatearFechaAR(r.fecha_checkin)}`}
                        </span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
          </div>
        )
      ) : (
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Departamento</span>
          <select name="depto_id" className={clsEntrada} required>
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
            defaultValue={elegida?.fecha_checkin ?? ""}
            className={clsEntrada}
            required={modo === "suelto"}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Hasta</span>
          <input
            type="date"
            name="fecha_hasta"
            defaultValue={elegida?.fecha_checkout ?? ""}
            className={clsEntrada}
            required={modo === "suelto"}
          />
        </label>
      </div>
      {modo === "reserva" && elegida && (
        <p className="text-xs text-slate-500">
          Si las dejás vacías se usan las fechas de la estadía.
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Notas</span>
        <textarea name="notas" className={clsAreaTexto} />
      </label>

      {estado && "error" in estado && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          ✓ {estado.ok}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}
