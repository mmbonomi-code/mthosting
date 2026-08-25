"use client";

import { useRef, useState, useTransition } from "react";
import type { EstadoFormulario } from "./tipos";

export type FotoExistente = { id: string; url: string | null };

/** Fotos de una categoría (terminado / arreglar / huésped). Solo suma: no se sacan desde acá. */
export default function SubidorFotos({
  fotos,
  subir,
  etiqueta,
}: {
  fotos: FotoExistente[];
  subir: (estadoPrevio: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  etiqueta: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<EstadoFormulario>(null);

  const enviar = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const fd = new FormData();
    for (const archivo of lista) fd.append("archivos", archivo);
    iniciar(async () => {
      setMensaje(await subir(null, fd));
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <div className="grid grid-cols-3 gap-2">
        {fotos.map((f) =>
          f.url ? (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </a>
          ) : null,
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-600 text-slate-400 transition-colors hover:bg-slate-800/60 disabled:opacity-60"
        >
          <span className="text-xl">📷</span>
          <span className="text-xs">{subiendo ? "Subiendo…" : "Agregar"}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic"
        capture="environment"
        onChange={(e) => enviar(e.target.files)}
        className="hidden"
      />
      {mensaje && "error" in mensaje && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {mensaje.error}
        </p>
      )}
    </div>
  );
}
