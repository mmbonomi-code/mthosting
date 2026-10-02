"use client";

import { useRef, useState, useTransition } from "react";
import { clsBoton } from "@/lib/ui";
import { TONO_TAREA } from "@/lib/estados";
import { comprimirImagen } from "@/lib/limpiezas/comprimir";
import Badge from "@/app/componentes/Badge";
import { deshacerLlave, dejarLlave } from "./acciones";

/**
 * "Dejé la llave en el candado", con foto. La foto es obligatoria: el botón
 * abre la cámara y la marca se guarda recién cuando la foto subió.
 *
 * Se achica en el celular antes de subirla (spec Fase 2 §2.7), igual que
 * las fotos de las limpiezas: datos móviles y teléfonos de gama baja.
 */
export default function DejarLlave({
  eventoId,
  hecha,
  hora,
  fotoUrl,
}: {
  eventoId: string;
  hecha: boolean;
  hora: string | null;
  fotoUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const enviar = (lista: FileList | null) => {
    const archivo = lista?.[0];
    if (!archivo) return;
    iniciar(async () => {
      setError(null);
      const listo = await comprimirImagen(archivo);
      const fd = new FormData();
      fd.append("foto", listo, listo.name);
      const r = await dejarLlave(eventoId, fd);
      if (r?.error) setError(r.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const deshacer = () =>
    iniciar(async () => {
      setError(null);
      const r = await deshacerLlave(eventoId);
      if (r?.error) setError(r.error);
    });

  return (
    <div className="flex flex-col gap-2">
      {hecha ? (
        <div className="flex flex-wrap items-center gap-2">
          {fotoUrl && (
            <a
              href={fotoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="size-16 shrink-0 overflow-hidden rounded-lg border border-borde-control bg-elevada"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fotoUrl} alt="Llave en el candado" className="h-full w-full object-cover" loading="lazy" />
            </a>
          )}
          <Badge tono={TONO_TAREA.hecha}>✓ Llave en el candado</Badge>
          {hora && <span className="text-xs tabular-nums text-tinta-etiqueta">{hora}</span>}
          <button
            type="button"
            onClick={deshacer}
            disabled={enviando}
            className={clsBoton("discreto", "chico")}
          >
            {enviando ? "Guardando…" : "Deshacer"}
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            className={`${clsBoton("primario", "grande")} w-full`}
          >
            <span aria-hidden>📷</span>
            {enviando ? "Subiendo la foto…" : "Dejé la llave · sacar foto"}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            onChange={(e) => enviar(e.target.files)}
            className="hidden"
          />
        </>
      )}
      {error && <p className="text-sm text-error-text">{error}</p>}
    </div>
  );
}
