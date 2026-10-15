"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { guardarLlave, leerLlaves, quitarLlave, type LlavePendiente } from "@/lib/logistica/llaves-db";
import { dejarLlave } from "./acciones";

/**
 * Las fotos de llaves que esperan señal (decisión del dueño, 14/10/2026).
 *
 * En un sótano o un palier sin señal, "dejé la llave" no puede perderse ni
 * obligar a volver a la calle a sacar la foto. La foto se guarda en el
 * celular PRIMERO y recién después se intenta subir; si no hay señal, sube
 * sola cuando vuelve, con la hora en que se sacó.
 *
 * Mismo criterio que las fotos de "Mis limpiezas" (PendientesProvider).
 */

type Contexto = {
  /** Las que todavía no subieron, por llegada. */
  pendientes: Map<string, LlavePendiente>;
  /** Lo que el servidor rechazó, por llegada. Reintentar no lo arregla. */
  errores: Map<string, string>;
  enLinea: boolean;
  registrar: (eventoId: string, archivo: File) => Promise<void>;
  /** Saca una foto de la cola sin subirla ("Deshacer" antes de que suba). */
  descartar: (eventoId: string) => Promise<void>;
};

const Ctx = createContext<Contexto | null>(null);

export function useLlavesPendientes(): Contexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLlavesPendientes necesita estar dentro de LlavesPendientes");
  return ctx;
}

const suscribirseAConexion = (avisar: () => void) => {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
};

/**
 * Manda UNA foto. TIRA si no se pudo hablar con el servidor (queda en la
 * cola); si el servidor contestó, devuelve su error o null.
 */
async function mandar(l: LlavePendiente): Promise<string | null> {
  const fd = new FormData();
  fd.append("foto", new File([l.archivo], l.nombre, { type: l.archivo.type }));
  fd.append("cuando", l.cuando);
  const r = await dejarLlave(l.eventoId, fd);
  return r?.error ?? null;
}

export default function LlavesPendientes({ children }: { children: React.ReactNode }) {
  const [pendientes, setPendientes] = useState<Map<string, LlavePendiente>>(new Map());
  const [errores, setErrores] = useState<Map<string, string>>(new Map());

  const enLinea = useSyncExternalStore(
    suscribirseAConexion,
    () => navigator.onLine,
    () => true,
  );

  const refrescar = useCallback(async () => {
    const lista = await leerLlaves();
    setPendientes(new Map(lista.map((l) => [l.eventoId, l])));
  }, []);

  const anotarError = useCallback((eventoId: string, error: string | null) => {
    setErrores((previos) => {
      const nuevos = new Map(previos);
      if (error) nuevos.set(eventoId, error);
      else nuevos.delete(eventoId);
      return nuevos;
    });
  }, []);

  /** Intenta subir una; devuelve false si no hubo señal. */
  const intentar = useCallback(
    async (l: LlavePendiente): Promise<boolean> => {
      try {
        const error = await mandar(l);
        // Contestó el servidor: sale de la cola, haya salido bien o no.
        await quitarLlave(l.eventoId);
        anotarError(l.eventoId, error);
        return true;
      } catch {
        return false;
      }
    },
    [anotarError],
  );

  const registrar = useCallback(
    async (eventoId: string, archivo: File) => {
      const l: LlavePendiente = {
        eventoId,
        archivo,
        nombre: archivo.name,
        cuando: new Date().toISOString(),
      };
      anotarError(eventoId, null);
      const guardada = await guardarLlave(l);
      await refrescar();
      const llego = await intentar(l);
      if (!llego && !guardada) {
        // Sin señal y sin dónde guardarla: lo único honesto es decirlo.
        anotarError(eventoId, "Sin señal, y el celular no pudo guardar la foto. Probá de nuevo.");
      }
      await refrescar();
    },
    [anotarError, intentar, refrescar],
  );

  const descartar = useCallback(
    async (eventoId: string) => {
      await quitarLlave(eventoId);
      await refrescar();
    },
    [refrescar],
  );

  // Al entrar se mira si quedó algo de la vez anterior, y cada vez que
  // vuelve la señal se intenta de nuevo. El estado se toca recién después
  // de hablar con la base, nunca de forma sincrónica al montar.
  useEffect(() => {
    let vivo = true;
    const ponerseAlDia = async () => {
      if (enLinea) {
        for (const l of await leerLlaves()) {
          if (!(await intentar(l))) break; // Sigue sin señal.
        }
      }
      const lista = await leerLlaves();
      if (vivo) setPendientes(new Map(lista.map((l) => [l.eventoId, l])));
    };
    void ponerseAlDia();
    return () => {
      vivo = false;
    };
  }, [enLinea, intentar]);

  const cantidad = pendientes.size;

  return (
    <Ctx.Provider value={{ pendientes, errores, enLinea, registrar, descartar }}>
      {(cantidad > 0 || !enLinea) && (
        <p
          role="status"
          className={`sticky top-0 z-10 rounded-lg px-3 py-2 text-sm font-medium ${
            cantidad > 0 ? "bg-aviso-soft/80 text-aviso-text-fuerte" : "bg-elevada text-tinta-suave"
          }`}
        >
          {cantidad > 0
            ? `${cantidad} ${cantidad === 1 ? "foto de llave" : "fotos de llaves"} sin subir todavía. ` +
              "Están guardadas en el celular y suben solas cuando vuelva la señal."
            : "Sin señal. Las fotos de las llaves se guardan y suben después."}
        </p>
      )}
      {children}
    </Ctx.Provider>
  );
}
