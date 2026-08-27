"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { claveDe, enOrden, type Pendiente, type PendienteNuevo } from "@/lib/limpiezas/pendientes";
import { encolar, leerCola, quitar } from "@/lib/limpiezas/pendientes-db";
import {
  guardarObservacionProxima,
  guardarViaticoMonto,
  tildarChecklistItem,
} from "./acciones";

type Contexto = {
  /** Cuántos cambios quedaron sin mandar. */
  cantidad: number;
  enLinea: boolean;
  /** Intenta mandar; si no se puede, lo encola y lo reintenta después. */
  registrar: (p: PendienteNuevo) => Promise<void>;
};

const Ctx = createContext<Contexto | null>(null);

export function usePendientes(): Contexto {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePendientes necesita estar dentro de PendientesProvider");
  return ctx;
}

/** Manda UNA operación al servidor. Es lo único que sabe traducir cola → acción. */
async function despachar(p: Pendiente): Promise<void> {
  if (p.clase === "checklist") {
    return tildarChecklistItem(p.limpiezaId, p.filaId, p.hecho);
  }
  if (p.campo === "observacion_proxima") {
    return guardarObservacionProxima(p.limpiezaId, p.valor);
  }
  return guardarViaticoMonto(p.limpiezaId, p.valor);
}

const suscribirseAConexion = (avisar: () => void) => {
  window.addEventListener("online", avisar);
  window.addEventListener("offline", avisar);
  return () => {
    window.removeEventListener("online", avisar);
    window.removeEventListener("offline", avisar);
  };
};

export default function PendientesProvider({ children }: { children: React.ReactNode }) {
  const [cantidad, setCantidad] = useState(0);

  // Con useSyncExternalStore y no con estado propio: el navegador ya sabe si
  // hay conexión, y así no hace falta escribir estado dentro de un efecto.
  // En el servidor se asume que hay señal.
  const enLinea = useSyncExternalStore(
    suscribirseAConexion,
    () => navigator.onLine,
    () => true,
  );

  const refrescar = useCallback(async () => {
    setCantidad((await leerCola()).length);
  }, []);

  const registrar = useCallback(
    async (parcial: PendienteNuevo) => {
      const p = { ...parcial, clave: claveDe(parcial), creadoEn: Date.now() } as Pendiente;
      try {
        await despachar(p);
        // Por si esta misma operación había quedado encolada de antes.
        await quitar(p.clave);
      } catch {
        await encolar(p);
      }
      await refrescar();
    },
    [refrescar],
  );

  // Al entrar se mira si quedó algo de la vez anterior, y cada vez que
  // vuelve la señal se intenta de nuevo. Va todo adentro del efecto y no en
  // un useCallback aparte: así el estado se toca recién después de hablar
  // con la base, nunca de forma sincrónica al montar.
  useEffect(() => {
    let vivo = true;
    const ponerseAlDia = async () => {
      if (enLinea) {
        // En orden, y si vuelve a fallar se corta: sigue sin señal.
        for (const p of enOrden(await leerCola())) {
          try {
            await despachar(p);
            await quitar(p.clave);
          } catch {
            break;
          }
        }
      }
      const cuantas = (await leerCola()).length;
      if (vivo) setCantidad(cuantas);
    };
    void ponerseAlDia();
    return () => {
      vivo = false;
    };
  }, [enLinea]);

  return (
    <Ctx.Provider value={{ cantidad, enLinea, registrar }}>
      {(cantidad > 0 || !enLinea) && (
        <p
          role="status"
          className={`sticky top-0 z-10 rounded-lg px-3 py-2 text-sm font-medium ${
            cantidad > 0
              ? "bg-amber-950/80 text-amber-200"
              : "bg-slate-800 text-slate-300"
          }`}
        >
          {cantidad > 0
            ? `Sin señal: ${cantidad} ${cantidad === 1 ? "cambio" : "cambios"} sin guardar. Se guardan solos cuando vuelva.`
            : "Sin señal. Podés seguir trabajando."}
        </p>
      )}
      {children}
    </Ctx.Provider>
  );
}
