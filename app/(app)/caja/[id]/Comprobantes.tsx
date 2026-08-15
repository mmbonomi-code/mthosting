"use client";

import { useRef, useState, useTransition } from "react";
import type { EstadoFormulario } from "@/lib/caja/tipos";

export type Comprobante = {
  id: string;
  nombre: string;
  url: string | null;
  esPdf: boolean;
};

/** La factura y el comprobante de la transferencia. Opcionales. */
export default function Comprobantes({
  archivos,
  subir,
  ocultar,
}: {
  archivos: Comprobante[];
  subir: (fd: FormData) => Promise<EstadoFormulario>;
  ocultar: (comprobanteId: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState<EstadoFormulario>(null);
  const [arrastrando, setArrastrando] = useState(false);

  const enviar = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const fd = new FormData();
    for (const archivo of lista) fd.append("archivos", archivo);
    iniciar(async () => {
      setMensaje(await subir(fd));
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-2">
        {archivos.map((a) => (
          <div
            key={a.id}
            className="relative aspect-square overflow-hidden rounded-md border border-borde-control bg-superficie-alt"
          >
            {a.esPdf || !a.url ? (
              <span className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center text-xs text-tinta-suave">
                <span className="text-2xl">📄</span>
                <span className="line-clamp-2 break-all">{a.nombre}</span>
              </span>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={a.url}
                alt={a.nombre}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            )}
            {a.url && (
              <a
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0"
                aria-label={`Abrir ${a.nombre}`}
              />
            )}
            <form action={ocultar.bind(null, a.id)} className="absolute right-1 top-1">
              <button
                type="submit"
                title="Sacar el comprobante"
                /* Va encima de la miniatura, así que necesita fondo propio y
                   borde: sobre una foto clara, sin eso desaparece. */
                className="flex size-6 items-center justify-center rounded-full border border-borde bg-superficie text-sm text-tinta-suave shadow-sm transition-colors hover:bg-error-soft hover:text-error-text"
              >
                ×
              </button>
            </form>
          </div>
        ))}

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
          className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs transition-colors ${
            arrastrando
              ? "border-borde bg-superficie-alt text-tinta"
              : "border-borde-fuerte text-tinta-suave hover:bg-superficie"
          } disabled:opacity-60`}
        >
          <span className="text-xl">+</span>
          {subiendo ? "Subiendo…" : "Agregar"}
        </button>
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
        <p role="alert" className="rounded-md bg-error-soft px-3 py-2 text-sm text-error-text">
          {mensaje.error}
        </p>
      )}
    </div>
  );
}
