/**
 * Dónde se guarda la cola de envío mientras no hay señal.
 *
 * IndexedDB y no localStorage: localStorage es síncrono (traba la pantalla),
 * tiene un límite chico, y guarda solo texto — las fotos no entrarían. Igual
 * la regla de CLAUDE.md se respeta en lo que importa: acá NO vive ningún dato
 * de negocio, solo lo que todavía no se pudo mandar. Ver `pendientes.ts`.
 *
 * Cada operación se guarda con su `clave`, así que volver a encolar la misma
 * fila del checklist pisa la anterior sin trabajo extra.
 *
 * Todo devuelve un valor seguro si IndexedDB no está disponible (modo
 * privado de algunos navegadores, storage bloqueado): la app sigue andando
 * sin cola, exactamente como andaba antes.
 */

import type { FotoPendiente, Pendiente } from "./pendientes";

const NOMBRE_DB = "mthosting-pendientes";
const ALMACEN = "cola";
/** Las fotos van en su propio almacén: no se pisan y pesan distinto. */
const ALMACEN_FOTOS = "fotos";
const VERSION = 2;

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
        db.createObjectStore(ALMACEN, { keyPath: "clave" });
      }
      if (!db.objectStoreNames.contains(ALMACEN_FOTOS)) {
        db.createObjectStore(ALMACEN_FOTOS, { keyPath: "id" });
      }
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => resolver(null);
    pedido.onblocked = () => resolver(null);
  });
}

/** Suma o pisa una operación. Si no se puede guardar, no rompe nada. */
export async function encolar(p: Pendiente): Promise<void> {
  const db = await abrir();
  if (!db) return;
  await new Promise<void>((resolver) => {
    const tx = db.transaction(ALMACEN, "readwrite");
    tx.objectStore(ALMACEN).put(p);
    tx.oncomplete = () => resolver();
    tx.onerror = () => resolver();
    tx.onabort = () => resolver();
  });
  db.close();
}

/** Todo lo que quedó sin mandar. */
export async function leerCola(): Promise<Pendiente[]> {
  const db = await abrir();
  if (!db) return [];
  const cola = await new Promise<Pendiente[]>((resolver) => {
    const tx = db.transaction(ALMACEN, "readonly");
    const pedido = tx.objectStore(ALMACEN).getAll();
    pedido.onsuccess = () => resolver((pedido.result ?? []) as Pendiente[]);
    pedido.onerror = () => resolver([]);
  });
  db.close();
  return cola;
}

/** Se llama recién cuando el servidor confirmó: antes no. */
export async function quitar(clave: string): Promise<void> {
  const db = await abrir();
  if (!db) return;
  await new Promise<void>((resolver) => {
    const tx = db.transaction(ALMACEN, "readwrite");
    tx.objectStore(ALMACEN).delete(clave);
    tx.oncomplete = () => resolver();
    tx.onerror = () => resolver();
    tx.onabort = () => resolver();
  });
  db.close();
}

// --- Fotos ------------------------------------------------------------------

/**
 * Guarda una foto para subir. Se llama ANTES de intentar la subida: si el
 * teléfono se queda sin señal, o la app se cierra, la foto ya está a salvo.
 */
export async function encolarFoto(f: FotoPendiente): Promise<void> {
  const db = await abrir();
  if (!db) return;
  await new Promise<void>((resolver) => {
    const tx = db.transaction(ALMACEN_FOTOS, "readwrite");
    tx.objectStore(ALMACEN_FOTOS).put(f);
    tx.oncomplete = () => resolver();
    tx.onerror = () => resolver();
    tx.onabort = () => resolver();
  });
  db.close();
}

/** Las fotos que todavía no subieron. */
export async function leerFotos(): Promise<FotoPendiente[]> {
  const db = await abrir();
  if (!db) return [];
  const fotos = await new Promise<FotoPendiente[]>((resolver) => {
    const tx = db.transaction(ALMACEN_FOTOS, "readonly");
    const pedido = tx.objectStore(ALMACEN_FOTOS).getAll();
    pedido.onsuccess = () => resolver((pedido.result ?? []) as FotoPendiente[]);
    pedido.onerror = () => resolver([]);
  });
  db.close();
  return fotos;
}

/** Recién cuando el servidor confirmó que la guardó. */
export async function quitarFoto(id: string): Promise<void> {
  const db = await abrir();
  if (!db) return;
  await new Promise<void>((resolver) => {
    const tx = db.transaction(ALMACEN_FOTOS, "readwrite");
    tx.objectStore(ALMACEN_FOTOS).delete(id);
    tx.oncomplete = () => resolver();
    tx.onerror = () => resolver();
    tx.onabort = () => resolver();
  });
  db.close();
}
