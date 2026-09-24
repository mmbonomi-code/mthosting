/**
 * El color de cada estado, en UN solo lugar (docs/IDENTIDAD-VISUAL.md §6).
 *
 * Hoy cada pantalla decide su color con un condicional suelto y los estados de
 * reclamos ni siquiera tienen color: salen como texto gris. Esto los reúne.
 *
 * LA LÓGICA ES TRANSVERSAL a los tres dominios, y es lo importante de respetar
 * al agregar estados nuevos:
 *
 *   gris    · inerte, nadie lo está tocando
 *   azul    · en manos de otro, esperando
 *   naranja · pasando ahora, o urgente
 *   verde   · cerrado bien
 *   rojo    · cerrado mal
 *   violeta · excepción
 *
 * Dos estados llevan además una señal NO CROMÁTICA, para no depender solo del
 * color: "tentativa" va con borde punteado y "vence pronto" con un punto.
 *
 * Este archivo es presentación pura: no sabe de reglas de negocio ni consulta
 * nada. Cada pantalla traduce sus datos a un nombre de estado y pide el color.
 */

export type Tono = {
  /** Clases de Tailwind, todas apuntando a tokens de la identidad. */
  clases: string;
  /** Un punto de color antes del texto. Solo la alerta de vencimiento. */
  punto?: boolean;
};

/**
 * Los roles de color. Un estado nuevo elige uno de estos, no un color.
 * AVISO es el ámbar de "hay que ocuparse": no es un estado del ciclo, es una
 * marca de atención (por presentar, late checkout).
 */
const INERTE = "bg-elevada text-tinta-tenue";
const ESPERANDO = "bg-dato-soft text-dato-text";
const AHORA = "bg-ahora-soft text-ahora-text";
const AVISO = "bg-aviso-soft text-aviso-text";
const CERRADO_BIEN = "bg-exito-soft text-exito-text";
const CERRADO_MAL = "bg-error-soft text-error-text";
const EXCEPCION = "bg-excepcion-soft text-excepcion-text";

/**
 * Tentativa: violeta de excepción, con borde punteado. El borde es la señal
 * que se ve aunque no se distingan los colores.
 */
const TENTATIVA = `${EXCEPCION} border border-dashed border-excepcion`;

// ---------------------------------------------------------------------------
// Reservas
// ---------------------------------------------------------------------------

export type EstadoReserva =
  | "confirmada"
  | "tentativa"
  | "en_curso"
  | "finalizada"
  | "cancelada";

export const TONO_RESERVA: Record<EstadoReserva, Tono> = {
  // Verde de marca, no el semántico: una reserva confirmada es el estado
  // bueno del negocio, no un "cerrado bien".
  confirmada: { clases: "bg-primary-soft text-primary-soft-text" },
  // Importada del calendario y sin confirmar.
  tentativa: { clases: TENTATIVA },
  en_curso: { clases: ESPERANDO },
  finalizada: { clases: INERTE },
  cancelada: { clases: CERRADO_MAL },
};

export const ETIQUETA_RESERVA: Record<EstadoReserva, string> = {
  confirmada: "Confirmada",
  tentativa: "Tentativa",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

// ---------------------------------------------------------------------------
// Limpiezas
// ---------------------------------------------------------------------------

/**
 * La identidad define cuatro; la base tiene seis. Los dos que faltaban se
 * ubican con la misma lógica de color, que es justamente para lo que está:
 *
 *   verificada → verde, es otro "cerrado bien" después de completada.
 *   cancelada  → gris. Una limpieza cancelada no salió mal: no va a pasar.
 *                Rojo la confundiría con un reclamo rechazado.
 */
export type EstadoLimpieza =
  | "pendiente"
  | "asignada"
  | "en_curso"
  | "hecha"
  | "verificada"
  | "cancelada";

export const TONO_LIMPIEZA: Record<EstadoLimpieza, Tono> = {
  pendiente: { clases: INERTE },
  asignada: { clases: ESPERANDO },
  en_curso: { clases: AHORA },
  hecha: { clases: CERRADO_BIEN },
  verificada: { clases: CERRADO_BIEN },
  cancelada: { clases: INERTE },
};

export const ETIQUETA_LIMPIEZA: Record<EstadoLimpieza, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  en_curso: "En proceso",
  hecha: "Completada",
  verificada: "Verificada",
  cancelada: "Cancelada",
};

/**
 * Lo que la persona de limpieza ya marcó desde el celular, para las listas
 * de la oficina (pedido del dueño, 24/09/2026): "Empezar" la deja iniciada y
 * "Finalizar", finalizada. Verificada también cuenta como finalizada. Antes
 * de empezar no se muestra nada: eso ya lo dice el responsable asignado.
 */
export function avanceDeLimpieza(estado: string): { texto: string; tono: Tono } | null {
  if (estado === "en_curso") return { texto: "Limpieza iniciada", tono: TONO_LIMPIEZA.en_curso };
  if (estado === "hecha" || estado === "verificada") {
    return { texto: "Limpieza finalizada", tono: TONO_LIMPIEZA.hecha };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Reclamos por daños
// ---------------------------------------------------------------------------

export type EstadoReclamo =
  | "borrador"
  | "por_presentar"
  | "presentado"
  | "escalado"
  | "cobrado"
  | "rechazado"
  | "descartado";

export const TONO_RECLAMO: Record<EstadoReclamo, Tono> = {
  borrador: { clases: INERTE },
  // Corre contra reloj: ámbar de advertencia, no el naranja de "ahora".
  por_presentar: { clases: AVISO },
  presentado: { clases: ESPERANDO },
  escalado: { clases: EXCEPCION },
  cobrado: { clases: CERRADO_BIEN },
  rechazado: { clases: CERRADO_MAL },
  // Lo bajamos nosotros: inerte, no fallido.
  descartado: { clases: "bg-elevada text-tinta-etiqueta" },
};

export const ETIQUETA_RECLAMO: Record<EstadoReclamo, string> = {
  borrador: "Borrador",
  por_presentar: "Por presentar",
  presentado: "Presentado",
  escalado: "Escalado a AirCover",
  cobrado: "Cobrado",
  rechazado: "Rechazado",
  descartado: "Descartado",
};

// ---------------------------------------------------------------------------
// Cambios detectados en el calendario de Airbnb
// ---------------------------------------------------------------------------

/**
 * Lo que el calendario sugiere y todavía nadie confirmó (lib/ical/cambios.ts).
 * Los tres son violeta: son la excepción por definición, algo que pasó por
 * fuera del flujo normal. La señal no cromática es el signo de pregunta de la
 * etiqueta: dice "posible", no "es".
 */
export type CambioCalendario = "posible_cancelacion" | "cambio_fechas" | "cambio_depto";

export const TONO_CAMBIO_CALENDARIO: Record<CambioCalendario, Tono> = {
  posible_cancelacion: { clases: EXCEPCION },
  cambio_fechas: { clases: EXCEPCION },
  cambio_depto: { clases: EXCEPCION },
};

export const ETIQUETA_CAMBIO_CALENDARIO: Record<CambioCalendario, string> = {
  posible_cancelacion: "¿Cancelada?",
  cambio_fechas: "¿Cambió de fecha?",
  cambio_depto: "¿Otro depto?",
};

// ---------------------------------------------------------------------------
// Alerta de vencimiento
// ---------------------------------------------------------------------------

/** Para un reclamo que vence en menos de tres días. */
export const TONO_VENCIMIENTO: Tono = {
  clases: "bg-alerta-soft text-alerta-text font-semibold",
  punto: true,
};

/**
 * Fila que vence: fondo tenue y filete al costado.
 *
 * REGLA: una sola alarma por fila. O la fila se pinta, o el badge de
 * vencimiento — nunca las dos señales con el badge en rojo encima.
 */
export const FILA_VENCE = "bg-ahora-soft/40 border-l-[3px] border-l-ahora";

// ---------------------------------------------------------------------------
// Marcas de una reserva en el Día y la Semana
// ---------------------------------------------------------------------------

/**
 * No son estados del ciclo sino señales sueltas que se apilan al lado del
 * departamento: una reserva puede ser tentativa, tener late checkout y estar
 * coordinada a la vez. Cada una elige un rol como cualquier estado.
 */
export type MarcaReserva =
  | "tentativa"
  | "coordinado"
  | "late"
  | "movido"
  | "cancelada"
  | "check_in_out"
  | "fecha_manual";

export const TONO_MARCA: Record<MarcaReserva, Tono> = {
  tentativa: { clases: TENTATIVA },
  coordinado: { clases: CERRADO_BIEN },
  late: { clases: AVISO },
  movido: { clases: ESPERANDO },
  cancelada: { clases: CERRADO_MAL },
  // Sale y entra gente el mismo día: la limpieza no tiene margen.
  check_in_out: { clases: CERRADO_MAL },
  fecha_manual: { clases: "bg-elevada-hover text-tinta-media" },
};

export const ETIQUETA_MARCA: Record<MarcaReserva, string> = {
  tentativa: "Tentativa",
  coordinado: "Coordinado",
  late: "Late",
  movido: "Movido",
  cancelada: "Cancelada",
  check_in_out: "Check in/out",
  fecha_manual: "Fecha a mano",
};

// ---------------------------------------------------------------------------

/**
 * Todos, en una lista. NO como un objeto único: `en_curso` y `cancelada`
 * existen en dos dominios con colores distintos y se pisarían.
 */
export const CATALOGO: {
  dominio: "reserva" | "limpieza" | "reclamo" | "calendario" | "marca" | "alerta";
  estado: string;
  etiqueta: string;
  tono: Tono;
}[] = [
  ...Object.entries(TONO_RESERVA).map(([estado, tono]) => ({
    dominio: "reserva" as const,
    estado,
    etiqueta: ETIQUETA_RESERVA[estado as EstadoReserva],
    tono,
  })),
  ...Object.entries(TONO_LIMPIEZA).map(([estado, tono]) => ({
    dominio: "limpieza" as const,
    estado,
    etiqueta: ETIQUETA_LIMPIEZA[estado as EstadoLimpieza],
    tono,
  })),
  ...Object.entries(TONO_RECLAMO).map(([estado, tono]) => ({
    dominio: "reclamo" as const,
    estado,
    etiqueta: ETIQUETA_RECLAMO[estado as EstadoReclamo],
    tono,
  })),
  ...Object.entries(TONO_CAMBIO_CALENDARIO).map(([estado, tono]) => ({
    dominio: "calendario" as const,
    estado,
    etiqueta: ETIQUETA_CAMBIO_CALENDARIO[estado as CambioCalendario],
    tono,
  })),
  ...Object.entries(TONO_MARCA).map(([estado, tono]) => ({
    dominio: "marca" as const,
    estado,
    etiqueta: ETIQUETA_MARCA[estado as MarcaReserva],
    tono,
  })),
  {
    dominio: "alerta",
    estado: "vencimiento",
    etiqueta: "Vence pronto",
    tono: TONO_VENCIMIENTO,
  },
];
