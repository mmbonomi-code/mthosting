"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { clsEntrada, clsEtiqueta } from "@/lib/ui";
import { calcularNoches } from "@/lib/reservas/validar";
import type { EstadoFormulario } from "@/lib/reservas/tipos";

export type ValoresReserva = {
  codigo_reserva: string;
  depto_id: string;
  huesped_nombre: string;
  huesped_contacto: string;
  fecha_checkin: string;
  fecha_checkout: string;
  adultos: string;
  ninos: string;
  bebes: string;
  payout_monto: string;
};

/**
 * Alta y edición de una reserva. Es el mismo formulario: lo único que cambia
 * es que en el alta hay que elegir de dónde sale la reserva, y en la edición
 * el código ya no se toca.
 */
export default function FormularioReserva({
  accion,
  valores,
  departamentos,
  esAlta,
  avisoAirbnb,
  urlCancelar,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  valores: ValoresReserva;
  departamentos: { id: string; codigo: string; nombre_interno: string }[];
  esAlta: boolean;
  /** Texto de la advertencia de §2.10.bis, o null si nadie la va a pisar. */
  avisoAirbnb: string | null;
  urlCancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  const [tipo, setTipo] = useState<"directa" | "airbnb">("directa");
  const [entrada, setEntrada] = useState(valores.fecha_checkin);
  const [salida, setSalida] = useState(valores.fecha_checkout);

  const noches = calcularNoches(entrada || null, salida || null);

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {avisoAirbnb && (
        <p className="rounded-md bg-aviso-soft/40 px-4 py-3 text-sm text-aviso-text">
          {avisoAirbnb}
        </p>
      )}

      {esAlta && (
        <fieldset className="flex flex-col gap-2">
          <legend className={clsEtiqueta}>¿De dónde sale esta reserva?</legend>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-borde-control px-3 py-2.5 transition-colors hover:bg-superficie">
            <input
              type="radio"
              name="tipo"
              value="directa"
              checked={tipo === "directa"}
              onChange={() => setTipo("directa")}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm text-tinta">
                Reserva directa, fuera de Airbnb
              </span>
              <span className="block text-xs text-tinta-tenue">
                Le generamos un código propio. Ninguna importación la va a tocar.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-borde-control px-3 py-2.5 transition-colors hover:bg-superficie">
            <input
              type="radio"
              name="tipo"
              value="airbnb"
              checked={tipo === "airbnb"}
              onChange={() => setTipo("airbnb")}
              className="mt-1 size-4 accent-primary"
            />
            <span>
              <span className="block text-sm text-tinta">
                De Airbnb, todavía no importada
              </span>
              <span className="block text-xs text-tinta-tenue">
                Con el código real, la próxima importación la completa sola en vez
                de duplicarla.
              </span>
            </span>
          </label>
        </fieldset>
      )}

      {esAlta ? (
        tipo === "airbnb" && (
          <label className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>Código de Airbnb</span>
            <input
              name="codigo_reserva"
              defaultValue={valores.codigo_reserva}
              placeholder="HMCNXQKHP5"
              className={`${clsEntrada} font-mono uppercase`}
            />
          </label>
        )
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Código de reserva</span>
          <p className="font-mono text-base text-tinta-suave">{valores.codigo_reserva}</p>
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Departamento</span>
        <select
          name="depto_id"
          defaultValue={valores.depto_id}
          className={clsEntrada}
          required
        >
          <option value="">— Elegir —</option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo} · {d.nombre_interno}
            </option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Nombre del huésped</span>
          <input
            name="huesped_nombre"
            defaultValue={valores.huesped_nombre}
            className={clsEntrada}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Teléfono</span>
          <input
            name="huesped_contacto"
            defaultValue={valores.huesped_contacto}
            placeholder="+54 9 11 4428-2700"
            className={clsEntrada}
          />
          <span className="text-xs text-tinta-tenue">
            Si es argentino y le falta el 9 después del +54, se lo agregamos solo.
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Entrada</span>
          <input
            type="date"
            name="fecha_checkin"
            value={entrada}
            onChange={(e) => setEntrada(e.target.value)}
            className={clsEntrada}
            required
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Salida</span>
          <input
            type="date"
            name="fecha_checkout"
            value={salida}
            onChange={(e) => setSalida(e.target.value)}
            className={clsEntrada}
            required
          />
          <span className="text-xs text-tinta-tenue">
            {noches === null
              ? "La salida tiene que ser posterior a la entrada."
              : `${noches} noche${noches === 1 ? "" : "s"}.`}
          </span>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Adultos</span>
          <input
            type="number"
            min={0}
            name="adultos"
            defaultValue={valores.adultos}
            className={clsEntrada}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Niños</span>
          <input
            type="number"
            min={0}
            name="ninos"
            defaultValue={valores.ninos}
            className={clsEntrada}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Bebés</span>
          <input
            type="number"
            min={0}
            name="bebes"
            defaultValue={valores.bebes}
            className={clsEntrada}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 sm:max-w-64">
        <span className={clsEtiqueta}>Ganancia (USD)</span>
        <input
          type="text"
          inputMode="decimal"
          name="payout_monto"
          defaultValue={valores.payout_monto}
          className={clsEntrada}
        />
      </label>

      {estado && "error" in estado && (
        <p role="alert" className="rounded-md bg-error-soft px-4 py-3 text-sm text-error-text">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-md bg-exito-soft px-4 py-3 text-sm text-exito-text">
          ✓ {estado.ok}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : esAlta ? "Crear reserva" : "Guardar cambios"}
        </button>
        <Link
          href={urlCancelar}
          className="rounded-md border border-borde-control px-5 py-2.5 text-sm text-tinta-suave transition-colors hover:bg-superficie-alt"
        >
          Cancelar
        </Link>
      </div>

      {esAlta && (
        <p className="text-xs text-tinta-tenue">
          Al crearla se arman solos el check-in, el check-out y la limpieza, igual
          que con una reserva importada.
        </p>
      )}
    </form>
  );
}
