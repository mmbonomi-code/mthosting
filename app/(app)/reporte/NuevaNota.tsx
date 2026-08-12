"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import CamposNota from "./CamposNota";
import type { EstadoFormulario } from "@/lib/reporte/tipos";

/** El formulario de alta, plegado hasta que hace falta. */
export default function NuevaNota({
  seccion,
  accion,
  departamentos,
  personas,
}: {
  seccion: "anuncio" | "pendiente";
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  departamentos: { id: string; codigo: string }[];
  personas: { id: string; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(
    accion,
    null,
  );

  // Guardado con éxito: se limpia para poder anotar el siguiente de una.
  useEffect(() => {
    if (estado && "ok" in estado) formRef.current?.reset();
  }, [estado]);

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="self-start rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-200"
      >
        + {seccion === "anuncio" ? "Nuevo aviso" : "Nuevo pendiente"}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={enviar}
      className="flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-4"
    >
      <CamposNota
        seccion={seccion}
        valores={{
          titulo: "",
          detalle: "",
          fecha: "",
          fecha_hasta: "",
          depto_id: "",
          responsable_id: "",
        }}
        departamentos={departamentos}
        personas={personas}
      />

      {estado && "error" in estado && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-lg bg-emerald-950 px-3 py-2 text-sm text-emerald-300">
          ✓ {estado.ok} Podés seguir anotando.
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
