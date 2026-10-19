"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { horaARDe } from "@/lib/fechas";
import { comprimirImagen } from "@/lib/limpiezas/comprimir";
import { deshacerLlave } from "./acciones";
import { useLlavesPendientes } from "./LlavesPendientes";

/**
 * "Dejé la llave en el candado", con foto, en el costado de la fila.
 *
 *  - Sin dejar: un botón de cámara.
 *  - Dejada sin señal: la miniatura con borde ámbar y "falta subir". La
 *    foto está guardada en el celular y sube sola (LlavesPendientes).
 *  - Dejada: la miniatura con ✓ y la hora. Tocarla abre la foto.
 *
 * "Deshacer" va aparte, chico, debajo: tocar la miniatura tiene que abrir la
 * foto, no borrarla. Sin pregunta de confirmación (pedido del dueño,
 * 19/10/2026): si se deshace por error, se saca otra foto.
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
  const { pendientes, errores, registrar, descartar } = useLlavesPendientes();

  const enEspera = pendientes.get(eventoId) ?? null;
  const errorCola = errores.get(eventoId) ?? null;

  // La foto guardada se muestra desde el celular. Se arma al derivar y se
  // suelta en el efecto, para no dejar memoria tomada en un teléfono chico.
  const urlLocal = useMemo(
    () => (enEspera ? URL.createObjectURL(enEspera.archivo) : null),
    [enEspera],
  );
  useEffect(() => {
    return () => {
      if (urlLocal) URL.revokeObjectURL(urlLocal);
    };
  }, [urlLocal]);

  const enviar = (lista: FileList | null) => {
    const archivo = lista?.[0];
    if (!archivo) return;
    iniciar(async () => {
      setError(null);
      const listo = await comprimirImagen(archivo);
      await registrar(eventoId, listo);
      if (inputRef.current) inputRef.current.value = "";
    });
  };

  const deshacer = () =>
    iniciar(async () => {
      setError(null);
      // Si todavía no subió, alcanza con sacarla del celular.
      if (enEspera) return descartar(eventoId);
      const r = await deshacerLlave(eventoId);
      if (r?.error) setError(r.error);
    });

  const url = enEspera ? urlLocal : hecha ? fotoUrl : null;
  const marcada = !!enEspera || hecha;
  const textoHora = enEspera ? horaARDe(enEspera.cuando) : hora;
  const mensaje = error ?? errorCola;

  return (
    <div className="flex flex-col items-end gap-1">
      {marcada ? (
        <div className="flex items-center">
          <button
            type="button"
            onClick={deshacer}
            disabled={enviando}
            className="h-11 px-2 text-xs text-tinta-etiqueta underline underline-offset-2 hover:text-tinta-suave"
          >
            Deshacer
          </button>
          {/* La hora va adentro de la miniatura: así la fila no crece. */}
          <a
            href={url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver la foto de la llave"
            className={`relative block size-11 shrink-0 overflow-hidden rounded-lg border-2 bg-elevada ${
              enEspera ? "border-aviso" : "border-exito"
            }`}
          >
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
            )}
            <span
              className={`absolute inset-x-0 bottom-0 text-center text-[10px] font-semibold leading-4 tabular-nums ${
                enEspera ? "bg-aviso-soft/90 text-aviso-text" : "bg-exito-soft/90 text-exito-text"
              }`}
            >
              {enEspera ? "subir" : `✓${textoHora ?? ""}`}
            </span>
          </a>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={enviando}
            aria-label="Dejé la llave: sacar foto"
            className="flex h-11 min-w-[4.75rem] items-center justify-center gap-1 rounded-lg bg-primary text-sm font-semibold text-tinta-inversa hover:bg-primary-hover disabled:opacity-45"
          >
            <span aria-hidden>📷</span>
            {enviando ? "…" : "Llave"}
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
      {mensaje && <p className="w-32 text-right text-xs text-error-text">{mensaje}</p>}
    </div>
  );
}
