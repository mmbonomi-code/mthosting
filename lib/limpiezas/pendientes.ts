/**
 * La cola de lo que todavía no se pudo mandar al servidor (spec Fase 2 §10:
 * "cachear la lista del día y encolar el cambio de estado + las fotos").
 *
 * QUÉ ES Y QUÉ NO ES. CLAUDE.md prohíbe guardar datos de negocio en el
 * navegador, y esto NO los guarda: es un buffer de ENVÍO. Solo vive acá lo
 * que se intentó mandar y no salió, y se borra apenas el servidor lo
 * confirma. La fuente de verdad sigue siendo la base, siempre. Si alguien
 * borra los datos del navegador pierde, como mucho, los últimos tildes que
 * no habían llegado — nunca información que el servidor ya tenía.
 *
 * Por qué hace falta: la persona limpia adentro de un edificio, muchas veces
 * sin señal. Cada tilde del checklist es un viaje al servidor y son 27 por
 * limpieza; sin esto, los que fallan se pierden sin que nadie se entere y la
 * limpieza queda a medias en el sistema aunque en la realidad esté terminada.
 *
 * Este archivo tiene la lógica PURA (qué se encola, cómo se fusiona, en qué
 * orden sale). El acceso a IndexedDB vive en `pendientes-db.ts`, para que
 * esto se pueda probar sin navegador.
 */

export type Pendiente =
  | {
      clase: "checklist";
      /** Identifica la operación: dos tildes de la misma fila se pisan. */
      clave: string;
      limpiezaId: string;
      filaId: string;
      hecho: boolean;
      creadoEn: number;
    }
  | {
      clase: "texto";
      clave: string;
      limpiezaId: string;
      campo: "observacion_proxima" | "viatico_monto";
      valor: string;
      creadoEn: number;
    };

/**
 * Una operación recién nacida, antes de que se le calcule la clave y la hora.
 *
 * Pasa por un genérico a propósito: `Omit` aplicado directo sobre una unión
 * la aplasta en un solo tipo y se pierden los campos propios de cada clase
 * (`filaId`, `campo`). Con el parámetro `T` suelto, TypeScript reparte el
 * Omit variante por variante y la unión sobrevive.
 */
type SinMeta<T> = T extends unknown ? Omit<T, "clave" | "creadoEn"> : never;
export type PendienteNuevo = SinMeta<Pendiente>;

/**
 * Qué operaciones son "la misma cosa". Dos tildes sobre la misma fila del
 * checklist son la misma operación: vale el último. Lo mismo con un campo de
 * texto que se editó tres veces sin señal.
 */
export function claveDe(p: PendienteNuevo): string {
  return p.clase === "checklist"
    ? `checklist|${p.limpiezaId}|${p.filaId}`
    : `texto|${p.limpiezaId}|${p.campo}`;
}

/**
 * Suma una operación a la cola, pisando la anterior de la misma clave.
 *
 * Pisar y no acumular es lo correcto acá: todas estas operaciones fijan un
 * estado final ("este ítem queda tildado", "la observación dice esto"), no
 * son incrementos. Mandar los tres intentos intermedios daría el mismo
 * resultado y gastaría datos móviles al pedo.
 */
export function fusionar(cola: Pendiente[], nueva: Pendiente): Pendiente[] {
  const sinLaVieja = cola.filter((p) => p.clave !== nueva.clave);
  return [...sinLaVieja, nueva];
}

/** Sale en el orden en que se generó: el sistema ve lo que pasó, en su orden. */
export function enOrden(cola: Pendiente[]): Pendiente[] {
  return [...cola].sort((a, b) => a.creadoEn - b.creadoEn);
}

/** Cuántas cosas quedan sin mandar. Es lo que se le muestra a la persona. */
export function contar(cola: Pendiente[]): number {
  return cola.length;
}

// ---------------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------------

/**
 * Una foto esperando subir.
 *
 * Van aparte de las otras operaciones y con otras reglas: NUNCA se pisan
 * entre sí. Un tilde fija un estado final y el último vale; dos fotos son
 * dos fotos, y perder una porque llegó otra sería perder trabajo hecho.
 *
 * La foto se guarda ANTES de intentar subirla, no después de que falle: así
 * queda a salvo desde el momento en que se saca, incluso si la app se cierra
 * en el medio de la subida.
 */
export type FotoPendiente = {
  id: string;
  limpiezaId: string;
  tipo: "terminado" | "arreglar" | "huesped";
  /** Ya comprimida: lo que se guarda es lo mismo que se va a subir. */
  archivo: Blob;
  nombre: string;
  creadoEn: number;
};

/** Las de una categoría de una limpieza, en el orden en que se sacaron. */
export function fotosDe(
  cola: FotoPendiente[],
  limpiezaId: string,
  tipo: FotoPendiente["tipo"],
): FotoPendiente[] {
  return cola
    .filter((f) => f.limpiezaId === limpiezaId && f.tipo === tipo)
    .sort((a, b) => a.creadoEn - b.creadoEn);
}
