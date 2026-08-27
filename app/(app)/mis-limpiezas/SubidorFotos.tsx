"use client";

import { useEffect, useMemo, useRef, useTransition } from "react";
import { comprimirImagen } from "@/lib/limpiezas/comprimir";
import { fotosDe } from "@/lib/limpiezas/pendientes";
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
}: {
  fotos: FotoExistente[];
  limpiezaId: string;
  tipo: "terminado" | "arreglar" | "huesped";
  etiqueta: string;
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

        {enEspera.map((f) => (
          <div
            key={f.id}
            className="relative aspect-square overflow-hidden rounded-lg border border-amber-800 bg-slate-800"
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
            <span className="absolute inset-x-0 bottom-0 bg-amber-950/90 px-1 py-0.5 text-center text-[10px] font-medium text-amber-200">
              guardada, falta subir
            </span>
          </div>
        ))}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-600 text-slate-400 transition-colors hover:bg-slate-800/60 disabled:opacity-60"
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
        capture="environment"
        onChange={(e) => enviar(e.target.files)}
        className="hidden"
      />
    </div>
  );
}
