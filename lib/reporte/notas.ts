/**
 * Reporte del back office: pendientes, anuncios y equipamiento de bebé.
 *
 * Lo que en el sistema viejo era un cuadro de texto donde se escribía
 * "11/8 Tapicero abonar 5 sillas", acá es una fila con fecha y estado. La
 * diferencia práctica es esta: el sistema puede saber que algo venció.
 *
 * Funciones puras, con tests. `hoy` siempre entra desde afuera (hoyAR).
 */

import {
  BORDE_PLAZO as BORDE_POR_PLAZO,
  TONO_PLAZO,
  type Plazo,
  type Tono,
} from "@/lib/estados";

export type Seccion = "anuncio" | "pendiente";
export type EstadoNota = "pendiente" | "hecho";

export type Nota = {
  id: string;
  seccion: Seccion;
  titulo: string;
  detalle: string | null;
  fecha: string | null;
  fecha_hasta: string | null;
  depto_id: string | null;
  depto_codigo: string | null;
  responsable_id: string | null;
  responsable_nombre: string | null;
  estado: EstadoNota;
};

/**
 * El color de un pendiente según su fecha:
 *   vencido   — la fecha ya pasó y sigue pendiente
 *   hoy       — vence hoy
 *   proximo   — dentro de los próximos 3 días
 *   tranquilo — más adelante
 *   sin_fecha — no tiene fecha; no vence nunca
 *   hecho     — ya está resuelto, no importa la fecha
 */
export type EstadoPlazo =
  | "hecho"
  | "vencido"
  | "hoy"
  | "proximo"
  | "tranquilo"
  | "sin_fecha";

/** A partir de acá se considera "próximo". */
export const DIAS_PROXIMO = 3;

export function diasHasta(fecha: string, hoy: string): number {
  return (Date.parse(`${fecha}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) / 86_400_000;
}

export function estadoDePlazo(nota: Nota, hoy: string): EstadoPlazo {
  if (nota.estado === "hecho") return "hecho";
  if (!nota.fecha) return "sin_fecha";

  // Un anuncio con tramo vence cuando termina el tramo, no cuando empieza.
  const limite = nota.fecha_hasta ?? nota.fecha;
  const dias = diasHasta(limite, hoy);

  if (dias < 0) return "vencido";
  if (dias === 0) return "hoy";
  if (dias <= DIAS_PROXIMO) return "proximo";
  return "tranquilo";
}

/** Los que hay que mirar hoy: vencidos o que vencen hoy. */
export function requiereAtencion(estado: EstadoPlazo): boolean {
  return estado === "vencido" || estado === "hoy";
}

export function textoDePlazo(nota: Nota, hoy: string): string {
  const estado = estadoDePlazo(nota, hoy);
  if (estado === "hecho") return "Hecho";
  if (estado === "sin_fecha") return "Sin fecha";

  const limite = nota.fecha_hasta ?? nota.fecha!;
  const dias = diasHasta(limite, hoy);
  if (dias < 0) {
    const pasados = Math.abs(dias);
    return `Vencido hace ${pasados} día${pasados === 1 ? "" : "s"}`;
  }
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return `En ${dias} días`;
}

/**
 * ¿Este anuncio está vigente el día que se mira?
 *
 * Sin fecha, vale siempre: es una advertencia permanente del departamento.
 * Con fecha y sin fin, vale de esa fecha en adelante. Con tramo, vale
 * adentro del tramo, los dos extremos incluidos.
 */
export function vigenteEl(nota: Nota, dia: string): boolean {
  if (nota.estado === "hecho") return false;
  if (!nota.fecha) return true;
  if (dia < nota.fecha) return false;
  if (nota.fecha_hasta === null) return true;
  return dia <= nota.fecha_hasta;
}

/** Del más urgente al menos; lo hecho al fondo. */
export function ordenarPorUrgencia(notas: Nota[], hoy: string): Nota[] {
  const peso: Record<EstadoPlazo, number> = {
    vencido: 0,
    hoy: 1,
    proximo: 2,
    tranquilo: 3,
    sin_fecha: 4,
    hecho: 5,
  };
  return [...notas].sort((a, b) => {
    const pa = peso[estadoDePlazo(a, hoy)];
    const pb = peso[estadoDePlazo(b, hoy)];
    if (pa !== pb) return pa - pb;
    // Dentro del mismo grupo, primero la fecha más cercana.
    const fa = a.fecha_hasta ?? a.fecha ?? "9999-12-31";
    const fb = b.fecha_hasta ?? b.fecha ?? "9999-12-31";
    return fa.localeCompare(fb) || a.titulo.localeCompare(b.titulo);
  });
}

export type FiltrosNotas = {
  /** `null` = todos; `"sin_asignar"` = los que no tienen responsable. */
  responsable: string | null;
  /** Por defecto no se muestran los ya hechos. */
  verHechos: boolean;
  q: string;
};

export function filtrarNotas(notas: Nota[], filtros: FiltrosNotas): Nota[] {
  const termino = filtros.q.trim().toLowerCase();

  return notas.filter((n) => {
    if (!filtros.verHechos && n.estado === "hecho") return false;

    if (filtros.responsable === "sin_asignar") {
      if (n.responsable_id !== null) return false;
    } else if (filtros.responsable !== null) {
      if (n.responsable_id !== filtros.responsable) return false;
    }

    if (termino === "") return true;
    return [n.titulo, n.detalle, n.depto_codigo, n.responsable_nombre]
      .filter(Boolean)
      .some((campo) => campo!.toLowerCase().includes(termino));
  });
}

/** Cuántos pendientes están vencidos o vencen hoy: el número del menú. */
export function contarUrgentes(notas: Nota[], hoy: string): number {
  return notas.filter((n) => requiereAtencion(estadoDePlazo(n, hoy))).length;
}

/**
 * El color del plazo sale del mapa único (`lib/estados.ts`). Acá solo se
 * traduce el nombre del estado: esta pantalla dice "sin_fecha" y el mapa
 * dice "sin_plazo", que es lo mismo contado por reclamos.
 */
const COMO_PLAZO: Record<EstadoPlazo, Plazo> = {
  vencido: "vencido",
  hoy: "hoy",
  proximo: "proximo",
  tranquilo: "tranquilo",
  sin_fecha: "sin_plazo",
  hecho: "hecho",
};

export const BORDE_PLAZO: Record<EstadoPlazo, string> = Object.fromEntries(
  Object.entries(COMO_PLAZO).map(([e, p]) => [e, BORDE_POR_PLAZO[p]]),
) as Record<EstadoPlazo, string>;

export const TONO_PLAZO_NOTA: Record<EstadoPlazo, Tono> = Object.fromEntries(
  Object.entries(COMO_PLAZO).map(([e, p]) => [e, TONO_PLAZO[p]]),
) as Record<EstadoPlazo, Tono>;
