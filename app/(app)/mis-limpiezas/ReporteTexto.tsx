"use client";

import { useActionState } from "react";
import { clsAreaTexto } from "@/lib/ui";
import type { EstadoFormulario } from "./tipos";

/**
 * El texto que acompaña a una categoría de fotos, pegado abajo del subidor de
 * esa misma categoría (decisión del dueño, 02/09/2026).
 *
 * Antes vivía al final de la pantalla, en el bloque "Al terminar", lejos de
 * las fotos. Sacar la foto de la persiana rota y escribir qué le pasa eran
 * dos gestos separados por media pantalla, y en la práctica se hacía uno
 * solo: había fotos sin texto que nadie miraba nunca. Juntos, se ven como lo
 * que son — las dos mitades del mismo reporte.
 *
 * Lo usan "algo para arreglar" (cada envío crea un arreglo nuevo) y "lo que
 * dejó mal el huésped" (un solo texto que se reescribe, por eso `valorInicial`).
 */
export default function ReporteTexto({
  accion,
  placeholder,
  boton,
  enviando,
  valorInicial,
}: {
  accion: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  placeholder: string;
  boton: string;
  enviando: string;
  /** Lo ya escrito, cuando el texto se edita en vez de acumularse. */
  valorInicial?: string;
}) {
  const [estado, enviar, pendiente] = useActionState<EstadoFormulario, FormData>(accion, null);

  return (
    <form action={enviar} className="flex flex-col gap-2">
      <textarea
        name="descripcion"
        defaultValue={valorInicial}
        placeholder={placeholder}
        className={clsAreaTexto}
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pendiente}
          className="h-11 shrink-0 rounded-lg border border-borde-control px-4 text-sm font-medium text-tinta-media transition-colors hover:bg-elevada-hover disabled:opacity-60 sm:h-10"
        >
          {pendiente ? enviando : boton}
        </button>
        {estado && "ok" in estado && (
          <span className="text-sm text-exito-text">✓ {estado.ok}</span>
        )}
        {estado && "error" in estado && <span className="text-sm text-error-text">{estado.error}</span>}
      </div>
    </form>
  );
}
