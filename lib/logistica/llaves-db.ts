/**
 * Las fotos de llaves que todavía no subieron, guardadas en el celular.
 *
 * Mismo criterio que la cola de "Mis limpiezas" (`lib/limpiezas/pendientes-db.ts`):
 * IndexedDB y no localStorage, porque guarda archivos y no traba la
 * pantalla. Y la regla de CLAUDE.md se respeta en lo que importa: acá NO
 * vive ningún dato de negocio, solo lo que todavía no se pudo mandar.
 *
 * Base aparte de la de limpiezas: así esa no cambia de versión, y lo de
 * logística se puede tocar sin riesgo de romper la cola de las limpiadoras.
 *
 * Una llave pendiente por llegada (la clave es el evento): si se saca otra
 * foto antes de que suba la primera, la nueva reemplaza a la vieja.
 *
 * Si IndexedDB no está disponible (modo privado, storage bloqueado), todo
 * devuelve un valor seguro y la app anda como antes: sin señal, sin guardar.
 */

export type LlavePendiente = {
  eventoId: string;
  archivo: Blob;
  nombre: string;
  /** Cuándo se sacó la foto, en ISO. Es la hora que va a ver la oficina. */
  cuando: string;
};

const NOMBRE_DB = "mthosting-logistica";
const ALMACEN = "llaves";
const VERSION = 1;

function abrir(): Promise<IDBDatabase | null> {
  return new Promise((resolver) => {
    if (typeof indexedDB === "undefined") return resolver(null);
    let pedido: IDBOpenDBRequest;
    try {
      pedido = indexedDB.open(NOMBRE_DB, VERSION);
    } catch {
      return resolver(null);
    }
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(ALMACEN)) {
        db.createObjectStore(ALMACEN, { keyPath: "eventoId" });
      }
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => resolver(null);
    pedido.onblocked = () => resolver(null);
  });
}

async function enTransaccion(
  modo: IDBTransactionMode,
  operar: (almacen: IDBObjectStore) => void,
): Promise<boolean> {
  const db = await abrir();
  if (!db) return false;
  const ok = await new Promise<boolean>((resolver) => {
    const tx = db.transaction(ALMACEN, modo);
    operar(tx.objectStore(ALMACEN));
    tx.oncomplete = () => resolver(true);
    tx.onerror = () => resolver(false);
    tx.onabort = () => resolver(false);
  });
  db.close();
  return ok;
}

/** Guarda (o reemplaza) la foto de una llegada. Devuelve si se pudo guardar. */
export function guardarLlave(l: LlavePendiente): Promise<boolean> {
  return enTransaccion("readwrite", (a) => a.put(l));
}

/** Se llama recién cuando el servidor contestó: antes no. */
export async function quitarLlave(eventoId: string): Promise<void> {
  await enTransaccion("readwrite", (a) => a.delete(eventoId));
}

export async function leerLlaves(): Promise<LlavePendiente[]> {
  const db = await abrir();
  if (!db) return [];
  const lista = await new Promise<LlavePendiente[]>((resolver) => {
    const pedido = db.transaction(ALMACEN, "readonly").objectStore(ALMACEN).getAll();
    pedido.onsuccess = () => resolver((pedido.result ?? []) as LlavePendiente[]);
    pedido.onerror = () => resolver([]);
  });
  db.close();
  return lista.sort((a, b) => a.cuando.localeCompare(b.cuando));
}
