"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { clsBoton } from "@/lib/ui";
import { TONO_TAREA } from "@/lib/estados";
import { horaARDe } from "@/lib/fechas";
import { comprimirImagen } from "@/lib/limpiezas/comprimir";
import Badge from "@/app/componentes/Badge";
import { deshacerLlave } from "./acciones";
import { useLlavesPendientes } from "./LlavesPendientes";

/**
 * "Dejé la llave en el candado", con foto. La foto es obligatoria: el botón
 * abre la cámara.
 *
 * La foto se achica y se GUARDA en el celular antes de intentar subirla:
 * sin señal queda guardada, se ve con su marca de "falta subir" y sube sola
 * cuando vuelve la señal (LlavesPendientes). Para la persona que la sacó ya
 * está hecha; la oficina la ve recién cuando sube, con la hora en que se
 * sacó.
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

  const miniatura = (url: string, atenuada: boolean) => (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`size-16 shrink-0 overflow-hidden rounded-lg border bg-elevada ${
        atenuada ? "border-aviso-borde" : "border-borde-control"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt="Llave en el candado"
        className={`h-full w-full object-cover ${atenuada ? "opacity-60" : ""}`}
        loading="lazy"
      />
    </a>
  );

  const botonDeshacer = (
    <button type="button" onClick={deshacer} disabled={enviando} className={clsBoton("discreto", "chico")}>
      {enviando ? "Guardando…" : "Deshacer"}
    </button>
  );

  return (
    <div className="flex flex-col gap-2">
      {enEspera ? (
        <div className="flex flex-wrap items-center gap-2">
          {urlLocal && miniatura(urlLocal, true)}
          <Badge tono={TONO_TAREA.en_espera}>Llave dejada · falta subir la foto</Badge>
          <span className="text-xs tabular-nums text-tinta-etiqueta">{horaARDe(enEspera.cuando)}</span>
          {botonDeshacer}
        </div>
      ) : hecha ? (
        <div className="flex flex-wrap items-center gap-2">
          {fotoUrl && miniatura(fotoUrl, false)}
          <Badge tono={TONO_TAREA.hecha}>✓ Llave en el candado</Badge>
          {hora && <span className="text-xs tabular-nums text-tinta-etiqueta">{hora}</span>}
          {botonDeshacer}
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
            {enviando ? "Guardando la foto…" : "Dejé la llave · sacar foto"}
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
      {(error ?? errorCola) && <p className="text-sm text-error-text">{error ?? errorCola}</p>}
    </div>
  );
}
