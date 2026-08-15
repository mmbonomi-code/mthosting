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
        className="self-start rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover"
      >
        + Anotar cuna, silla o bañadera
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={enviar}
      className="flex flex-col gap-3 rounded-md border border-borde-control bg-superficie p-4"
    >
      <fieldset className="flex flex-col gap-1.5">
        <legend className={clsEtiqueta}>Qué se pidió</legend>
        <div className="flex flex-wrap gap-2">
          {TIPOS.map((t, i) => (
            <label
              key={t}
              className="flex cursor-pointer items-center gap-2 rounded-md border border-borde-control px-3 py-2 text-sm text-tinta transition-colors hover:bg-superficie-alt"
            >
              <input
                type="radio"
                name="tipo"
                value={t}
                defaultChecked={i === 0}
                className="size-4 accent-primary"
              />
              {ETIQUETA_TIPO[t]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex gap-2 border-t border-borde-control pt-3">
        <button
          type="button"
          onClick={() => setModo("reserva")}
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            modo === "reserva"
              ? "bg-warm-100 text-tinta"
              : "text-tinta-suave hover:bg-superficie-alt"
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
          className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
            modo === "suelto"
              ? "bg-warm-100 text-tinta"
              : "text-tinta-suave hover:bg-superficie-alt"
          }`}
        >
          Suelto
        </button>
      </div>

      {modo === "reserva" ? (
        elegida ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-fondo px-3 py-2.5">
            <span>
              <span className="block text-sm text-tinta">
                {elegida.huesped_nombre ?? "Sin nombre"}{" "}
                <span className="font-mono text-tinta-suave">{elegida.codigo_reserva}</span>
              </span>
              <span className="block text-xs text-tinta-tenue">
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
              className="text-xs text-tinta-suave underline decoration-borde-fuerte underline-offset-4 hover:text-tinta"
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
              <ul className="flex flex-col overflow-hidden rounded-md border border-borde-control">
                {buscando ? (
                  <li className="px-3 py-2 text-sm text-tinta-tenue">Buscando…</li>
                ) : resultados.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-tinta-tenue">
                    Ninguna reserva coincide.
                  </li>
                ) : (
                  resultados.map((r) => (
                    <li key={r.id} className="border-b border-borde last:border-0">
                      <button
                        type="button"
                        onClick={() => setElegida(r)}
                        className="w-full px-3 py-2 text-left transition-colors hover:bg-superficie-alt"
                      >
                        <span className="block text-sm text-tinta">
                          {r.huesped_nombre ?? "Sin nombre"}{" "}
                          <span className="font-mono text-tinta-suave">
                            {r.codigo_reserva}
                          </span>
                        </span>
                        <span className="block text-xs text-tinta-tenue">
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
        <p className="text-xs text-tinta-tenue">
          Si las dejás vacías se usan las fechas de la estadía.
        </p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Notas</span>
        <textarea name="notas" className={clsAreaTexto} />
      </label>

      {estado && "error" in estado && (
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-md bg-exito-soft px-3 py-2 text-sm text-exito-text">
          ✓ {estado.ok}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-tinta-inversa hover:bg-primary-hover disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-md border border-borde-control px-4 py-2 text-sm text-tinta-suave hover:bg-superficie-alt"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}
