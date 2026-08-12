"use client";

import { clsAreaTexto, clsEntrada, clsEtiqueta } from "@/lib/ui";

export type ValoresNota = {
  titulo: string;
  detalle: string;
  fecha: string;
  fecha_hasta: string;
  depto_id: string;
  responsable_id: string;
};

/**
 * Los campos de una nota. Son los mismos al crear y al editar, así que viven
 * en un solo lugar.
 *
 * Un pendiente tiene una fecha y un responsable. Un anuncio puede tener un
 * tramo ("pintan el 28 y 29") y no tiene dueño: es del departamento.
 */
export default function CamposNota({
  seccion,
  valores,
  departamentos,
  personas,
}: {
  seccion: "anuncio" | "pendiente";
  valores: ValoresNota;
  departamentos: { id: string; codigo: string }[];
  personas: { id: string; nombre: string }[];
}) {
  const esAnuncio = seccion === "anuncio";

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>{esAnuncio ? "Aviso" : "Pendiente"}</span>
        <input
          name="titulo"
          defaultValue={valores.titulo}
          required
          autoComplete="off"
          placeholder={
            esAnuncio ? "Marcelo pinta la pared" : "Abonar 5 sillas al tapicero"
          }
          className={clsEntrada}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className={clsEtiqueta}>{esAnuncio ? "Desde" : "Fecha"}</span>
          <input
            type="date"
            name="fecha"
            defaultValue={valores.fecha}
            className={clsEntrada}
          />
          {!esAnuncio && (
            <span className="text-xs text-slate-500">
              Sin fecha no vence nunca y queda al fondo de la lista.
            </span>
          )}
        </label>

        {esAnuncio ? (
          <label className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>Hasta</span>
            <input
              type="date"
              name="fecha_hasta"
              defaultValue={valores.fecha_hasta}
              className={clsEntrada}
            />
            <span className="text-xs text-slate-500">
              Vacío: vale de la fecha de inicio en adelante.
            </span>
          </label>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className={clsEtiqueta}>Responsable</span>
            <select
              name="responsable_id"
              defaultValue={valores.responsable_id}
              className={clsEntrada}
            >
              <option value="">— Sin asignar —</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Departamento</span>
        <select
          name="depto_id"
          defaultValue={valores.depto_id}
          className={clsEntrada}
        >
          <option value="">— Ninguno en particular —</option>
          {departamentos.map((d) => (
            <option key={d.id} value={d.id}>
              {d.codigo}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">
          Con departamento y fecha, el aviso aparece solo en la vista del día.
        </span>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className={clsEtiqueta}>Detalle</span>
        <textarea
          name="detalle"
          defaultValue={valores.detalle}
          className={clsAreaTexto}
        />
      </label>

      {/* El anuncio no lleva responsable y el pendiente no lleva tramo: se
          mandan vacíos para no arrastrar el valor anterior al editar. */}
      {esAnuncio && <input type="hidden" name="responsable_id" value="" />}
      {!esAnuncio && <input type="hidden" name="fecha_hasta" value="" />}
    </>
  );
}
