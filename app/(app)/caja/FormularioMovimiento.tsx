"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { clsAreaTexto, clsEntrada, clsEtiqueta } from "@/lib/ui";
import type { EstadoFormulario } from "@/lib/caja/tipos";

export type ValoresMovimiento = {
  fecha: string;
  tipo: "ingreso" | "egreso";
  monto: string;
  categoria_id: string;
  depto_id: string;
  descripcion: string;
  reembolsable: boolean;
  usd_cambiado: string;
  tc_cambio: string;
};

/** `1716000` → `1.716.000`, para leer el resultado de un vistazo. */
function conPuntos(valor: number): string {
  return Math.round(valor).toLocaleString("es-AR");
}

function aNumero(texto: string): number | null {
  const limpio = texto.trim();
  if (limpio === "") return null;
  const n = Number(
    limpio.includes(",") ? limpio.replace(/\./g, "").replace(",", ".") : limpio.replace(/\./g, ""),
  );
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Todos los campos del formulario en un solo objeto, para poder vaciarlos
 * de un saque con un único `setState` (nueve por separado dispara renders
 * en cascada dentro del efecto que limpia tras un alta). */
type Campos = {
  tipo: "ingreso" | "egreso";
  fecha: string;
  monto: string;
  descripcion: string;
  depto: string;
  reembolsable: boolean;
  categoria: string;
  usd: string;
  tcCambio: string;
};

function camposIniciales(v: ValoresMovimiento): Campos {
  return {
    tipo: v.tipo,
    fecha: v.fecha,
    monto: v.monto,
    descripcion: v.descripcion,
    depto: v.depto_id,
    reembolsable: v.reembolsable,
    categoria: v.categoria_id,
    usd: v.usd_cambiado,
    tcCambio: v.tc_cambio,
  };
}

/**
 * Alta y edición de un movimiento. El monto va siempre positivo: el signo lo
 * da si es ingreso o egreso, no un menos escrito a mano.
 */
export default function FormularioMovimiento({
  accion,
  valores,
  categorias,
  departamentos,
  esAlta,
  urlCancelar,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  valores: ValoresMovimiento;
  categorias: { id: string; nombre: string; es_cambio: boolean }[];
  departamentos: { id: string; codigo: string }[];
  esAlta: boolean;
  urlCancelar: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );
  const [campos, setCampos] = useState<Campos>(() => camposIniciales(valores));
  const set = <K extends keyof Campos>(campo: K, valor: Campos[K]) =>
    setCampos((c) => ({ ...c, [campo]: valor }));

  // En un alta, cada "ok" nuevo es un movimiento distinto ya guardado: se
  // vacía el formulario para cargar el siguiente sin volver a "Caja" y tocar
  // "+ Movimiento" de nuevo. En edición no: ahí "ok" dice que quedaron
  // guardados los cambios de ESTE movimiento, no que hay que vaciar nada.
  //
  // Se compara durante el render, no en un efecto: es el patrón que React
  // recomienda para "derivar estado de un cambio" y evita el parpadeo de un
  // render de más que tendría un `useEffect` disparando el reset después.
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (esAlta && estado && "ok" in estado) setCampos(camposIniciales(valores));
  }

  const { tipo, fecha, monto, descripcion, depto, reembolsable, categoria, usd, tcCambio } =
    campos;

  // Un ingreso de una categoría de cambio se carga en dólares y tipo de
  // cambio: los pesos son el producto y no se escriben a mano.
  const esCambio =
    tipo === "ingreso" &&
    categorias.find((c) => c.id === categoria)?.es_cambio === true;

  const dolares = aNumero(usd);
  const cotizacion = aNumero(tcCambio);
  const pesosCalculados = dolares !== null && cotizacion !== null ? dolares * cotizacion : null;

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <fieldset className="flex gap-2">
        <legend className={`${clsEtiqueta} mb-1.5`}>Tipo</legend>
        {(["egreso", "ingreso"] as const).map((t) => (
          <label
            key={t}
            className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              tipo === t
                ? t === "ingreso"
                  ? "border-emerald-600 bg-emerald-950/40 text-emerald-200"
                  : "border-slate-400 bg-slate-800 text-white"
                : "border-slate-700 text-slate-400 hover:bg-slate-800/60"
            }`}
          >
            <input
              type="radio"
              name="tipo"
              value={t}
              checked={tipo === t}
              onChange={() => set("tipo", t)}
              className="sr-only"
            />
            {t === "ingreso" ? "Ingreso (entra plata)" : "Egreso (sale plata)"}
          </label>
        ))}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Fecha</span>
          <input
            type="date"
            name="fecha"
            value={fecha}
            onChange={(e) => set("fecha", e.target.value)}
            required
            className={clsEntrada}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Categoría</span>
          <select
            name="categoria_id"
            value={categoria}
            onChange={(e) => set("categoria", e.target.value)}
            required
            className={clsEntrada}
          >
            <option value="">— Elegir —</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {esCambio ? (
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-900/60 bg-emerald-950/20 p-4">
          <p className="text-xs uppercase tracking-wide text-emerald-400">
            Cambio de dólares
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Dólares cambiados</span>
              <input
                type="text"
                inputMode="decimal"
                name="usd_cambiado"
                value={usd}
                onChange={(e) => set("usd", e.target.value)}
                required
                placeholder="1200"
                className={clsEntrada}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={clsEtiqueta}>Tipo de cambio</span>
              <input
                type="text"
                inputMode="decimal"
                name="tc_cambio"
                value={tcCambio}
                onChange={(e) => set("tcCambio", e.target.value)}
                required
                placeholder="1430"
                className={clsEntrada}
              />
            </label>
          </div>
          <p className="text-sm text-slate-300">
            Entran{" "}
            <strong className="text-lg tabular-nums text-emerald-300">
              {pesosCalculados === null ? "—" : `$ ${conPuntos(pesosCalculados)}`}
            </strong>
          </p>
          <p className="text-xs text-slate-500">
            Los gastos que se paguen con esta plata van a costar a este tipo de
            cambio, no al dólar del día.
          </p>
        </div>
      ) : (
        <label className="flex flex-col gap-1.5 sm:max-w-64">
          <span className={clsEtiqueta}>Monto (pesos)</span>
          <input
            type="text"
            inputMode="decimal"
            name="monto"
            value={monto}
            onChange={(e) => set("monto", e.target.value)}
            required
            placeholder="367600"
            className={clsEntrada}
          />
          <span className="text-xs text-slate-500">
            Siempre positivo. El signo lo da si entra o sale.
          </span>
        </label>
      )}

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Detalle</span>
        <textarea
          name="descripcion"
          value={descripcion}
          onChange={(e) => set("descripcion", e.target.value)}
          className={clsAreaTexto}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Departamento</span>
        <select
          name="depto_id"
          value={depto}
          onChange={(e) => {
            set("depto", e.target.value);
            if (e.target.value === "") set("reembolsable", false);
          }}
          className={clsEntrada}
        >
          <option value="">— Ninguno: es un gasto general —</option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo}
            </option>
          ))}
        </select>
      </label>

      {/* El reembolso solo tiene sentido si hay a quién cobrárselo. */}
      {depto !== "" && (
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-700 px-3 py-2.5 transition-colors hover:bg-slate-800/60">
          <input
            type="checkbox"
            name="reembolsable"
            checked={reembolsable}
            onChange={(e) => set("reembolsable", e.target.checked)}
            className="mt-0.5 size-5 accent-amber-400"
          />
          <span>
            <span className="block text-base text-slate-100">
              Lo reembolsa el propietario
            </span>
            <span className="block text-xs text-slate-500">
              Queda pendiente de cobro hasta que lo marques cobrado.
            </span>
          </span>
        </label>
      )}

      {estado && "error" in estado && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-lg bg-emerald-950 px-4 py-3 text-sm text-emerald-300">
          ✓ {estado.ok}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200 disabled:opacity-60"
        >
          {pendiente ? "Guardando…" : esAlta ? "Guardar movimiento" : "Guardar cambios"}
        </button>
        <Link
          href={urlCancelar}
          className="rounded-lg border border-slate-700 px-5 py-2.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}
