"use client";

import Link from "next/link";
import { useActionState, useRef, useState, startTransition } from "react";
import { procesarResenas, type EstadoImportarResenas } from "./acciones";
import { clsBoton, clsBotonPrimario, clsEntrada } from "@/lib/ui";
import { diaARDe, formatearFechaAR } from "@/lib/fechas";
import type { Previa } from "@/lib/calidad/importar";

type Depto = { id: string; codigo: string };

function Contador({
  etiqueta,
  valor,
  tono = "normal",
}: {
  etiqueta: string;
  valor: number;
  tono?: "normal" | "aviso" | "dato";
}) {
  const color =
    valor > 0 && tono === "aviso"
      ? "text-aviso-text"
      : valor > 0 && tono === "dato"
        ? "text-dato-text"
        : "text-tinta";
  return (
    <div className="rounded-lg border border-borde px-4 py-3">
      <div className={`text-2xl font-semibold tabular-nums ${color}`}>{valor}</div>
      <div className="text-xs uppercase tracking-wide text-tinta-etiqueta">{etiqueta}</div>
    </div>
  );
}

/**
 * Importar el Excel de reseñas (docs/CALIDAD-ESPECIFICACION.md §5.5).
 *
 * El archivo se elige una vez y se manda dos veces: para la previa y para
 * confirmar. Por eso el envío es a mano y no con `<form action>`: React
 * vacía el formulario después de una acción, y la persona tendría que volver
 * a elegir el archivo para confirmar lo que acaba de revisar.
 */
export default function FormularioImportar({ deptos }: { deptos: Depto[] }) {
  const [estado, enviar, pendiente] = useActionState<EstadoImportarResenas, FormData>(
    procesarResenas,
    null,
  );
  const formulario = useRef<HTMLFormElement>(null);
  const [pasoEnCurso, setPasoEnCurso] = useState<"revisar" | "confirmar">("revisar");
  // Si se elige otro archivo, lo que se ve abajo es de un archivo que ya no
  // está elegido: se esconde hasta que se revise el nuevo.
  const [archivoElegido, setArchivoElegido] = useState(0);
  const [archivoEnviado, setArchivoEnviado] = useState(-1);

  function mandar(paso: "revisar" | "confirmar") {
    if (!formulario.current) return;
    const datos = new FormData(formulario.current);
    datos.set("paso", paso);
    setPasoEnCurso(paso);
    setArchivoEnviado(archivoElegido);
    startTransition(() => enviar(datos));
  }

  const vigente = archivoEnviado === archivoElegido;
  const previa = vigente && estado?.resultado === "previa" ? estado.previa : null;
  const hecho = vigente && estado?.resultado === "ok" ? estado.previa : null;

  return (
    <div className="flex flex-col gap-6">
      <form
        ref={formulario}
        onSubmit={(e) => {
          e.preventDefault();
          mandar("revisar");
        }}
        className="flex flex-col gap-4 rounded-xl border border-borde bg-elevada/30 p-4"
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-tinta-suave">Excel de reseñas de Airbnb</span>
          <input
            type="file"
            name="archivo"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            onChange={() => setArchivoElegido((n) => n + 1)}
            className="rounded-lg border border-dashed border-borde-fuerte bg-elevada px-4 py-6 text-sm text-tinta-suave file:mr-4 file:rounded-lg file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-tinta-inversa"
          />
        </label>

        {previa && previa.anunciosSinVincular.length > 0 && (
          <div className="flex flex-col gap-3 rounded-lg border border-aviso-borde bg-aviso-soft/40 p-4">
            <p className="text-sm text-aviso-text">
              Estos anuncios no están vinculados a ningún departamento. Elegí cuál es cada uno y
              revisá de nuevo; si lo dejás vacío, sus reseñas se guardan igual, sin departamento.
            </p>
            {previa.anunciosSinVincular.map((a) => (
              <label key={a.airbnb_listing_id} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="text-sm text-tinta-suave sm:w-80">
                  {a.anuncio ?? "Sin nombre"}{" "}
                  <span className="font-mono text-xs text-tinta-etiqueta">{a.airbnb_listing_id}</span>{" "}
                  <span className="text-tinta-etiqueta">
                    · {a.resenas} {a.resenas === 1 ? "reseña" : "reseñas"}
                  </span>
                </span>
                <select name={`vinculo:${a.airbnb_listing_id}`} defaultValue="" className={`${clsEntrada} sm:w-60`}>
                  <option value="">Sin vincular</option>
                  {deptos.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.codigo}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={pendiente} className={previa ? clsBoton("secundario") : clsBotonPrimario}>
            {pendiente && pasoEnCurso === "revisar" ? "Revisando…" : previa ? "Revisar de nuevo" : "Revisar"}
          </button>
          {previa && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => mandar("confirmar")}
              className={clsBotonPrimario}
            >
              {pendiente && pasoEnCurso === "confirmar" ? "Importando…" : "Confirmar importación"}
            </button>
          )}
        </div>
      </form>

      {vigente && estado?.resultado === "error" && (
        <div role="alert" className="rounded-xl bg-error-soft px-4 py-3 text-sm text-error-text">
          <p className="font-semibold">No se importó nada.</p>
          <p className="mt-1 whitespace-pre-wrap">{estado.error}</p>
        </div>
      )}

      {(previa ?? hecho) && <Resumen previa={(previa ?? hecho)!} hecho={!!hecho} />}
    </div>
  );
}

function Resumen({ previa, hecho }: { previa: Previa; hecho: boolean }) {
  const sinDepto = previa.anunciosSinVincular.reduce((n, a) => n + a.resenas, 0);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold text-tinta">
          {hecho ? "Importación terminada" : "Previa · todavía no se guardó nada"}
        </h2>
        <p className="text-sm text-tinta-tenue">
          {previa.archivo} · {previa.filasLeidas} filas
          {previa.desde && previa.hasta && (
            <>
              {" "}
              · check-in del {formatearFechaAR(previa.desde)} al {formatearFechaAR(previa.hasta)}
            </>
          )}
        </p>
      </div>

      {previa.yaCargadoEl && !hecho && (
        <p className="rounded-lg border border-dato-borde bg-dato-soft px-4 py-3 text-sm text-dato-text">
          Este mismo archivo ya se cargó el {formatearFechaAR(diaARDe(previa.yaCargadoEl) ?? "")}.
          Subirlo de nuevo no duplica nada: solo se escribe lo que haya cambiado.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Contador etiqueta="Nuevas" valor={previa.nuevas} />
        <Contador etiqueta="Se actualizan" valor={previa.actualizadas} />
        <Contador etiqueta="Sin cambios" valor={previa.sinCambios} />
        <Contador etiqueta="Con alerta" valor={previa.conAlerta} tono="aviso" />
      </div>

      <ul className="flex flex-col gap-1 rounded-xl border border-borde bg-superficie px-4 py-3 text-sm text-tinta-suave tabular-nums">
        <li>Unidas a su reserva: {previa.conReserva}</li>
        <li>
          Sin reserva en el sistema: {previa.sinReserva}{" "}
          <span className="text-tinta-etiqueta">
            (estadías anteriores a julio de 2026 o que no figuran; se guardan igual)
          </span>
        </li>
        {sinDepto > 0 && <li className="text-aviso-text">Sin departamento: {sinDepto}</li>}
      </ul>

      {previa.rechazadas.length > 0 && (
        <div className="rounded-xl border border-aviso-borde bg-aviso-soft/40 px-4 py-3">
          <h3 className="text-sm font-semibold text-aviso-text">
            Filas que no se cargan ({previa.rechazadas.length})
          </h3>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-aviso-text-fuerte/80">
            {previa.rechazadas.map((r) => (
              <li key={r.fila}>
                • Fila {r.fila}: {r.motivo}
              </li>
            ))}
          </ul>
        </div>
      )}

      {hecho && (
        <Link href="/calidad" className="text-sm text-tinta-suave underline hover:text-tinta">
          Ver Calidad →
        </Link>
      )}
    </div>
  );
}
