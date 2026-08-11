"use client";

import { useRef, useState, useTransition } from "react";
import type { EstadoFormulario } from "@/lib/reclamos/storage";

export type FotoEnFicha = {
  id: string;
  nombre: string;
  url: string | null;
  esPdf: boolean;
  origen: "limpieza" | "manual";
  tomada_at: string | null;
};

/**
 * Las fotos y presupuestos del reclamo. Se cargan desde la computadora, de a
 * varios archivos. Sacar una la oculta: el archivo queda guardado.
 */
export default function Evidencia({
  fotos,
  subir,
  ocultar,
  soloLectura,
}: {
  fotos: FotoEnFicha[];
  subir: (fd: FormData) => Promise<EstadoFormulario>;
  ocultar: (fotoId: string) => Promise<void>;
  soloLectura: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<EstadoFormulario>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const enviar = (archivos: FileList | null) => {
    if (!archivos || archivos.length === 0) return;
    const fd = new FormData();
    for (const archivo of archivos) fd.append("archivos", archivo);
    iniciar(async () => {
      setMensaje(await subir(fd));
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
        {fotos.map((f) => (
          <div
            key={f.id}
            className="relative aspect-square overflow-hidden rounded-lg border border-slate-700 bg-slate-800"
          >
            {f.esPdf || !f.url ? (
              <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-slate-400">
                <span className="text-2xl">📄</span>
                <span className="line-clamp-2 break-all">{f.nombre}</span>
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={f.url}
                alt={f.nombre}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}

            {f.url && (
              <a
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0"
                aria-label={`Abrir ${f.nombre}`}
              />
            )}

            {f.origen === "limpieza" && (
              <span className="absolute left-1 top-1 rounded bg-slate-950/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-200">
                Limpieza
              </span>
            )}

            {!soloLectura && (
              <form action={ocultar.bind(null, f.id)} className="absolute right-1 top-1">
                <button
                  type="submit"
                  title="Sacar de la evidencia"
                  className="flex size-6 items-center justify-center rounded-full bg-slate-950/70 text-sm text-slate-200 transition-colors hover:bg-red-900"
                >
                  ×
                </button>
              </form>
            )}
          </div>
        ))}

        {!soloLectura && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setArrastrando(true);
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={(e) => {
              e.preventDefault();
              setArrastrando(false);
              enviar(e.dataTransfer.files);
            }}
            disabled={subiendo}
            className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-xs transition-colors ${
              arrastrando
                ? "border-slate-300 bg-slate-800 text-white"
                : "border-slate-600 text-slate-400 hover:bg-slate-800/60"
            } disabled:opacity-60`}
          >
            <span className="text-xl">+</span>
            {subiendo ? "Subiendo…" : "Agregar"}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
        onChange={(e) => enviar(e.target.files)}
        className="hidden"
      />

      {mensaje && "error" in mensaje && (
        <p role="alert" className="rounded-lg bg-red-950 px-3 py-2 text-sm text-red-300">
          {mensaje.error}
        </p>
      )}

      <p className="text-xs text-slate-500">
        Fotos o presupuestos en PDF, hasta 15 MB cada uno. Se pueden arrastrar varios
        juntos. Las que cargó la limpieza en ese check-out vienen adjuntas: podés sacar
        las que no sirvan.
      </p>
    </div>
  );
}
