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
 * Los seis roles de color. Un estado nuevo elige uno de estos, no un color.
 *
 * DOS INTENSIDADES, y cuál va dónde no es decorativo:
 *
 *   suave  → fondo tenue con texto oscuro. Es el default y lo que pide el
 *            handoff. Sirve para informar: "esto está así".
 *   fuerte → relleno sólido con texto blanco. SOLO para lo que está pasando
 *            ahora o salió mal.
 *
 * El handoff está escrito para fondo oscuro, donde un rojo encendido salta
 * solo. Pasado a fondo claro, el mismo criterio se apaga y la alarma se
 * pierde entre lo que ya está resuelto (Marcos, 15/08/2026). El relleno
 * sólido devuelve ese peso.
 *
 * La restricción importante: fuerte se reserva a AHORA y CERRADO_MAL. Si
 * gritan todos, no grita ninguno.
 */
const INERTE = "bg-warm-100 text-warm-600";
const ESPERANDO = "bg-dato-soft text-dato-text";
const AHORA = "bg-accent text-tinta-inversa font-semibold";
/** La versión callada del acento, para lo que avisa sin exigir nada todavía. */
const AHORA_SUAVE = "bg-accent-soft text-accent-soft-text";
const CERRADO_BIEN = "bg-exito-soft text-exito-text";
const CERRADO_MAL = "bg-error text-tinta-inversa font-semibold";
const EXCEPCION = "bg-excepcion-soft text-excepcion-text";

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
  // Importada del calendario y sin confirmar. El borde punteado es la señal
  // que se ve aunque no se distingan los colores.
  tentativa: {
    clases: "bg-superficie-hover text-warm-600 border border-dashed border-borde-control",
  },
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
  borrador: { clases: "bg-superficie-hover text-warm-600" },
  // Corre contra reloj: ámbar de advertencia, no el naranja del acento.
  por_presentar: { clases: "bg-aviso-soft text-aviso-text" },
  presentado: { clases: ESPERANDO },
  escalado: { clases: EXCEPCION },
  cobrado: { clases: CERRADO_BIEN },
  rechazado: { clases: CERRADO_MAL },
  // Lo bajamos nosotros: inerte, no fallido.
  descartado: { clases: "bg-warm-100 text-warm-500" },
};

export const ETIQUETA_RECLAMO: Record<EstadoReclamo, string> = {
  borrador: "Borrador",
  por_presentar: "Por presentar",
  presentado: "Presentado",
  escalado: "Escalado",
  cobrado: "Cobrado",
  rechazado: "Rechazado",
  descartado: "Descartado",
};

// ---------------------------------------------------------------------------
// Alerta de vencimiento
// ---------------------------------------------------------------------------

/**
 * Un escalón por encima de AHORA, dentro de la misma familia: terracota más
 * profundo. "Está pasando ahora" y "ya tendría que estar hecho" no pueden
 * verse igual, y el handoff pide que el vencimiento salte incluso en una
 * tabla llena. Además lleva punto, que es la señal que se ve sin color.
 */
const URGENTE = "bg-accent-hover text-tinta-inversa font-semibold";

/** Para un reclamo que vence en menos de tres días. */
export const TONO_VENCIMIENTO: Tono = { clases: URGENTE, punto: true };

/**
 * Trabajo sin repartir: las limpiezas de un día que todavía no tienen a
 * nadie. No es el estado de una fila sino el resumen de un grupo, y es la
 * única alarma que puede ir en un encabezado.
 */
export const TONO_ALARMA: Tono = { clases: URGENTE, punto: true };

// ---------------------------------------------------------------------------
// Plazos: "Hoy", "En 2 días", "Vencido hace 3 días"
// ---------------------------------------------------------------------------

/**
 * Cuánto falta para que algo venza. Lo usan los pendientes del Reporte y los
 * reclamos: cuentan los días distinto pero significan lo mismo.
 *
 * Van en PÍLDORA, no en texto de color suelto. Un "En 2 días" escrito en
 * naranja al lado de una fecha gris no se lee como una alarma, se lee como
 * una fecha más; la forma cerrada es lo que lo separa del resto de la línea
 * (Marcos, 15/08/2026).
 */
export type Plazo =
  | "vencido"
  | "hoy"
  | "proximo"
  | "tranquilo"
  | "sin_plazo"
  | "hecho";

export const TONO_PLAZO: Record<Plazo, Tono> = {
  // Ya se pasó: es lo peor que puede decir esta columna.
  vencido: { clases: CERRADO_MAL },
  // Se vence hoy: todavía se llega, pero hay que moverse.
  hoy: { clases: URGENTE, punto: true },
  // Está en el horizonte. Suave: avisa sin gritar.
  proximo: { clases: AHORA_SUAVE },
  tranquilo: { clases: INERTE },
  sin_plazo: { clases: INERTE },
  hecho: { clases: CERRADO_BIEN },
};

/** Genéricas: cada pantalla escribe el texto real ("En 2 días", "Hoy"). */
export const ETIQUETA_PLAZO: Record<Plazo, string> = {
  vencido: "Vencido",
  hoy: "Vence hoy",
  proximo: "Vence pronto",
  tranquilo: "Con tiempo",
  sin_plazo: "Sin fecha",
  hecho: "Hecho",
};

/** El filete izquierdo de la fila, que acompaña a la píldora. */
export const BORDE_PLAZO: Record<Plazo, string> = {
  vencido: "border-l-error",
  hoy: "border-l-accent",
  proximo: "border-l-aviso",
  tranquilo: "border-l-borde-fuerte",
  sin_plazo: "border-l-borde-fuerte",
  hecho: "border-l-primary",
};

/**
 * Fila que vence: fondo tenue y filete al costado.
 *
 * REGLA: una sola alarma por fila. O la fila se pinta, o el badge de
 * vencimiento — nunca las dos señales con el badge en rojo encima.
 */
export const FILA_VENCE = "bg-accent-soft border-l-[3px] border-l-accent";

// ---------------------------------------------------------------------------

/**
 * Todos, en una lista. NO como un objeto único: `en_curso` y `cancelada`
 * existen en dos dominios con colores distintos y se pisarían.
 */
export const CATALOGO: {
  dominio: "reserva" | "limpieza" | "reclamo" | "alerta" | "plazo";
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
  {
    dominio: "alerta",
    estado: "vencimiento",
    etiqueta: "Vence pronto",
    tono: TONO_VENCIMIENTO,
  },
  {
    dominio: "alerta",
    estado: "sin_asignar",
    etiqueta: "Sin asignar",
    tono: TONO_ALARMA,
  },
  ...Object.entries(TONO_PLAZO).map(([estado, tono]) => ({
    dominio: "plazo" as const,
    estado,
    etiqueta: ETIQUETA_PLAZO[estado as Plazo],
    tono,
  })),
];
