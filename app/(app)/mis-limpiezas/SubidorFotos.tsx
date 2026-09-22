"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import { comprimirImagen } from "@/lib/limpiezas/comprimir";
import { fotosDe } from "@/lib/limpiezas/pendientes";
import type { TipoFoto } from "@/lib/limpiezas/fotos";
import { usePendientes } from "./PendientesProvider";

export type FotoExistente = { id: string; url: string | null };

/**
 * Fotos de una categoría (terminado / arreglar / huésped). Solo suma: no se
 * sacan desde acá.
 *
 * Cada foto se achica y se GUARDA antes de intentar subirla, así que queda a
 * salvo aunque no haya señal (spec Fase 2 §10). Las que todavía no subieron
 * se muestran igual, con su marca, para que la persona vea que no se
 * perdieron.
 */
export default function SubidorFotos({
  fotos,
  limpiezaId,
  tipo,
  etiqueta,
  ayuda,
  children,
}: {
  fotos: FotoExistente[];
  limpiezaId: string;
  tipo: TipoFoto;
  etiqueta: string;
  /** Una línea que explica para qué sirve esa categoría. Opcional. */
  ayuda?: string;
  /** Lo que va debajo de las fotos: hoy, el texto del arreglo. */
  children?: React.ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, iniciar] = useTransition();
  const { registrarFoto, fotosPendientes } = usePendientes();

  const enEspera = useMemo(
    () => fotosDe(fotosPendientes, limpiezaId, tipo),
    [fotosPendientes, limpiezaId, tipo],
  );

  // Las que esperan se muestran desde el archivo guardado. Se arman al
  // derivar y se sueltan en el efecto: si no, cada foto queda ocupando
  // memoria del teléfono hasta que se cierre la pestaña.
  const urls = useMemo(() => {
    const m = new Map<string, string>();
    for (const f of enEspera) m.set(f.id, URL.createObjectURL(f.archivo));
    return m;
  }, [enEspera]);

  useEffect(() => {
    return () => {
      for (const u of urls.values()) URL.revokeObjectURL(u);
    };
  }, [urls]);

  const enviar = (lista: FileList | null) => {
    if (!lista || lista.length === 0) return;
    const elegidos = [...lista];
    iniciar(async () => {
      for (const archivo of elegidos) {
        // Se achica ACÁ, en el teléfono, antes de gastar datos móviles
        // (spec §2.7). Si alguna no se puede comprimir, va la original.
        const listo = await comprimirImagen(archivo);
        await registrarFoto({ limpiezaId, tipo, archivo: listo, nombre: listo.name });
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <div>
        <span className="text-xs font-medium uppercase tracking-wide text-tinta-etiqueta">
          {etiqueta}
        </span>
        {ayuda && <p className="text-xs text-tinta-etiqueta">{ayuda}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {fotos.map((f) =>
          f.url ? (
            <a
              key={f.id}
              href={f.url}
              target="_blank"
              rel="noopener noreferrer"
              className="aspect-square overflow-hidden rounded-lg border border-borde-control bg-elevada"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </a>
          ) : null,
        )}

        {enEspera.map((f) => (
          <div
            key={f.id}
            className="relative aspect-square overflow-hidden rounded-lg border border-aviso-borde bg-elevada"
          >
            {urls.get(f.id) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urls.get(f.id)}
                alt=""
                className="h-full w-full object-cover opacity-60"
                loading="lazy"
              />
            )}
            <span className="absolute inset-x-0 bottom-0 bg-aviso-soft/90 px-1 py-0.5 text-center text-[10px] font-medium text-aviso-text-fuerte">
              guardada, falta subir
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-borde-fuerte text-tinta-tenue transition-colors hover:bg-superficie-alt disabled:opacity-60"
        >
          <span className="text-xl">📷</span>
          <span className="text-xs">{subiendo ? "Guardando…" : "Agregar"}</span>
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic"
        onChange={(e) => enviar(e.target.files)}
        className="hidden"
      />
      {children}
    </div>
  );
}
