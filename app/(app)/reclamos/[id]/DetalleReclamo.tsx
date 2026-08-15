"use client";

import { useRef, useState, useTransition } from "react";
import { clsAreaTexto, clsEntrada, clsEtiqueta } from "@/lib/ui";
import { CATEGORIAS, ETIQUETA_CATEGORIA } from "@/lib/reclamos/categorias";
import { pareceUrlDeAirbnb } from "@/lib/reclamos/estados";
import type { EstadoFormulario } from "@/lib/reclamos/storage";

/**
 * El detalle del reclamo. Se guarda solo al salir de cada campo, como la
 * coordinación del día: nadie se acuerda de apretar guardar, y perder lo
 * escrito es peor que guardar de más.
 */
export default function DetalleReclamo({
  guardar,
  valores,
  soloLectura,
}: {
  guardar: (fd: FormData) => Promise<EstadoFormulario>;
  valores: {
    motivo: string;
    monto_reclamado: string;
    categoria: string;
    nota_interna: string;
    url_airbnb: string;
  };
  soloLectura: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [guardando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [url, setUrl] = useState(valores.url_airbnb);

  const guardarAhora = () => {
    if (!formRef.current || soloLectura) return;
    const fd = new FormData(formRef.current);
    iniciar(async () => {
      const resultado = await guardar(fd);
      if (resultado && "error" in resultado) {
        setError(resultado.error);
        setGuardado(false);
      } else {
        setError(null);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 2000);
      }
    });
  };

  return (
    <form ref={formRef} className="flex flex-col gap-4">
      <div className="flex justify-end">
        <span className="text-xs text-tinta-tenue">
          {soloLectura
            ? "Cerrado: solo lectura"
            : guardando
              ? "Guardando…"
              : guardado
                ? "✓ Guardado"
                : "Se guarda solo"}
        </span>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Motivo del reclamo</span>
        <textarea
          name="motivo"
          defaultValue={valores.motivo}
          onBlur={guardarAhora}
          disabled={soloLectura}
          placeholder="Qué se dañó, dónde y cómo se detectó."
          className={`${clsAreaTexto} min-h-24`}
        />
        <span className="text-xs text-tinta-tenue">
          Este texto se copia y pega en el Centro de resoluciones.
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Monto reclamado (USD)</span>
          <input
            type="text"
            inputMode="decimal"
            name="monto_reclamado"
            defaultValue={valores.monto_reclamado}
            onBlur={guardarAhora}
            disabled={soloLectura}
            placeholder="180"
            className={clsEntrada}
          />
          <span className="text-xs text-tinta-tenue">
            Airbnb resuelve en dólares. Si el presupuesto está en pesos, convertilo
            antes de cargarlo.
          </span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>Categoría</span>
          <select
            name="categoria"
            defaultValue={valores.categoria}
            onChange={guardarAhora}
            disabled={soloLectura}
            className={clsEntrada}
          >
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {ETIQUETA_CATEGORIA[c]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Link del caso en Airbnb</span>
        <input
          type="url"
          name="url_airbnb"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={guardarAhora}
          disabled={soloLectura}
          placeholder="https://www.airbnb.com/resolutions/…"
          className={clsEntrada}
        />
        {!pareceUrlDeAirbnb(url) && (
          <span className="text-xs text-aviso-text">
            No parece un link de Airbnb. Se guarda igual, revisalo.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Nota interna</span>
        <textarea
          name="nota_interna"
          defaultValue={valores.nota_interna}
          onBlur={guardarAhora}
          disabled={soloLectura}
          placeholder="Para el equipo. No se le manda a Airbnb."
          className={clsAreaTexto}
        />
      </label>

      {error && (
        <p role="alert" className="rounded-md bg-error-soft px-4 py-3 text-sm text-error-text">
          {error}
        </p>
      )}
    </form>
  );
}
