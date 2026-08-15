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
        className="self-start rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-tinta-inversa transition-colors hover:bg-primary-hover"
      >
        + {seccion === "anuncio" ? "Nuevo aviso" : "Nuevo pendiente"}
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={enviar}
      className="flex flex-col gap-3 rounded-md border border-borde-control bg-superficie p-4"
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
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
          {estado.error}
        </p>
      )}
      {estado && "ok" in estado && (
        <p className="rounded-md bg-exito-soft px-3 py-2 text-sm text-exito-text">
          ✓ {estado.ok} Podés seguir anotando.
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
