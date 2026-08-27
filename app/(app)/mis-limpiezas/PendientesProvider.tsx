"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import {
  claveDe,
  enOrden,
  type FotoPendiente,
  type Pendiente,
  type PendienteNuevo,
} from "@/lib/limpiezas/pendientes";
import {
  encolar,
  encolarFoto,
  leerCola,
  leerFotos,
  quitar,
  quitarFoto,
} from "@/lib/limpiezas/pendientes-db";
import {
  guardarObservacionProxima,
  guardarViaticoMonto,
  subirFotos,
  tildarChecklistItem,
} from "./acciones";

type Contexto = {
  /** Cuántos cambios quedaron sin mandar. */
  cantidad: number;
  enLinea: boolean;
  /** Intenta mandar; si no se puede, lo encola y lo reintenta después. */
  registrar: (p: PendienteNuevo) => Promise<void>;
  /** Guarda la foto y la sube. Si no hay señal, queda guardada y sube después. */
  registrarFoto: (f: Omit<FotoPendiente, "id" | "creadoEn">) => Promise<void>;
  /** Las que todavía no subieron, para poder mostrarlas igual. */
  fotosPendientes: FotoPendiente[];
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

/**
 * Sube UNA foto de la cola.
 *
 * TIRA solo si no hubo forma de hablar con el servidor (sin señal): ahí la
 * foto se queda esperando. Si el servidor contestó —aunque haya rechazado la
 * foto por formato o tamaño— vuelve normal y la foto sale de la cola:
 * reintentarla para siempre no la va a arreglar y taparía a las que sí
 * pueden subir.
 */
async function subirUna(f: FotoPendiente): Promise<void> {
  const fd = new FormData();
  fd.append("archivos", new File([f.archivo], f.nombre, { type: f.archivo.type }));
  await subirFotos(f.limpiezaId, f.tipo, null, fd);
}

export default function PendientesProvider({ children }: { children: React.ReactNode }) {
  const [cantidad, setCantidad] = useState(0);
  const [fotosPendientes, setFotosPendientes] = useState<FotoPendiente[]>([]);

  // Con useSyncExternalStore y no con estado propio: el navegador ya sabe si
  // hay conexión, y así no hace falta escribir estado dentro de un efecto.
  // En el servidor se asume que hay señal.
  const enLinea = useSyncExternalStore(
    suscribirseAConexion,
    () => navigator.onLine,
    () => true,
  );

  const refrescar = useCallback(async () => {
    const [cola, fotos] = await Promise.all([leerCola(), leerFotos()]);
    setCantidad(cola.length + fotos.length);
    setFotosPendientes(fotos);
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

  /**
   * Guarda la foto y RECIÉN DESPUÉS intenta subirla. El orden importa: si se
   * intentara subir primero y el teléfono se quedara sin señal a mitad de
   * camino, o la persona cerrara la app, la foto se perdería. Guardada
   * primero, siempre queda en algún lado.
   */
  const registrarFoto = useCallback(
    async (parcial: Omit<FotoPendiente, "id" | "creadoEn">) => {
      const f: FotoPendiente = { ...parcial, id: crypto.randomUUID(), creadoEn: Date.now() };
      await encolarFoto(f);
      await refrescar();
      try {
        await subirUna(f);
        await quitarFoto(f.id);
      } catch {
        // Sin señal: queda guardada y sube cuando vuelva.
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
        // Las fotos van después de los tildes: pesan más y son menos urgentes.
        for (const f of (await leerFotos()).sort((a, b) => a.creadoEn - b.creadoEn)) {
          try {
            await subirUna(f);
            await quitarFoto(f.id);
          } catch {
            break;
          }
        }
      }
      const [cola, fotos] = await Promise.all([leerCola(), leerFotos()]);
      if (vivo) {
        setCantidad(cola.length + fotos.length);
        setFotosPendientes(fotos);
      }
    };
    void ponerseAlDia();
    return () => {
      vivo = false;
    };
  }, [enLinea]);

  return (
    <Ctx.Provider value={{ cantidad, enLinea, registrar, registrarFoto, fotosPendientes }}>
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
            ? `${cantidad} ${cantidad === 1 ? "cosa" : "cosas"} sin subir todavía` +
              (fotosPendientes.length > 0
                ? ` (${fotosPendientes.length} ${fotosPendientes.length === 1 ? "foto" : "fotos"})`
                : "") +
              ". Están guardadas y suben solas cuando vuelva la señal."
            : "Sin señal. Podés seguir trabajando: todo queda guardado."}
        </p>
      )}
      {children}
    </Ctx.Provider>
  );
}
