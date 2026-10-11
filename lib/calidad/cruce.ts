/**
 * Las decisiones de la importación de reseñas, sin base de datos
 * (docs/CALIDAD-ESPECIFICACION.md §3.1 a §3.3).
 *
 * Funciones PURAS, para poder probar cada regla sola: qué reserva le toca a
 * una reseña y qué queda en la fila cuando la reseña ya estaba cargada.
 */

import type { Database } from "../database.types";
import { CATEGORIAS, type ResenaParseada } from "./parser";

export type FilaResena = Database["public"]["Tables"]["resenas"]["Row"];
export type InsertResena = Database["public"]["Tables"]["resenas"]["Insert"];

export type ReservaCandidata = {
  id: string;
  depto_id: string | null;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  huesped_nombre: string | null;
};

/** Minúsculas y sin tildes, para comparar nombres de pila. */
function plano(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * ¿El nombre de la reserva corresponde al de la reseña? Airbnb pone en la
 * reseña solo el nombre de pila ("María Emilia") y en la reserva puede estar
 * completo ("María Emilia Insausti"), así que alcanza con que empiece igual.
 */
export function mismoHuesped(enResena: string | null, enReserva: string | null): boolean {
  if (!enResena || !enReserva) return false;
  const a = plano(enResena);
  const b = plano(enReserva);
  if (a === "" || b === "") return false;
  return b.startsWith(a) || a.startsWith(b) || b.split(/\s+/)[0] === a.split(/\s+/)[0];
}

/**
 * La reserva de una reseña: mismo departamento, mismo check-in y mismo
 * check-out. Las candidatas ya vienen SIN canceladas ni descartadas (lo
 * filtra la consulta): con una cancelada y su nueva reserva en las mismas
 * fechas, la cancelada no compite.
 *
 * Si quedan dos, desempata el nombre. Si el nombre no desempata, no se elige:
 * mejor sin reserva que con la equivocada.
 */
export function elegirReserva(
  resena: Pick<ResenaParseada, "fecha_checkin" | "fecha_checkout" | "huesped_nombre">,
  deptoId: string | null,
  candidatas: ReservaCandidata[],
): ReservaCandidata | null {
  if (!deptoId) return null;
  const mismas = candidatas.filter(
    (r) =>
      r.depto_id === deptoId &&
      r.fecha_checkin === resena.fecha_checkin &&
      r.fecha_checkout === resena.fecha_checkout,
  );
  if (mismas.length === 1) return mismas[0];
  if (mismas.length === 0) return null;
  const porNombre = mismas.filter((r) => mismoHuesped(resena.huesped_nombre, r.huesped_nombre));
  return porNombre.length === 1 ? porNombre[0] : null;
}

/** Los campos que se escriben desde el Excel, sin lo que pone la base. */
type CamposResena = Omit<InsertResena, "id" | "created_at" | "updated_at" | "activo" | "import_id">;

/** La reseña del Excel como fila de `resenas`. */
export function aFila(
  r: ResenaParseada,
  deptoId: string | null,
  reservaId: string | null,
): CamposResena {
  return {
    airbnb_resena_id: r.airbnb_resena_id,
    airbnb_listing_id: r.airbnb_listing_id,
    depto_id: deptoId,
    reserva_id: reservaId,
    anuncio_raw: r.anuncio_raw,
    huesped_nombre: r.huesped_nombre,
    fecha_checkin: r.fecha_checkin,
    fecha_checkout: r.fecha_checkout,
    puntaje_general: r.puntaje_general,
    puntaje_limpieza: r.puntajes.limpieza,
    puntaje_veracidad: r.puntajes.veracidad,
    puntaje_checkin: r.puntajes.checkin,
    puntaje_comunicacion: r.puntajes.comunicacion,
    puntaje_ubicacion: r.puntajes.ubicacion,
    puntaje_precio: r.puntajes.precio,
    resena_publica: r.resena_publica,
    comentario_privado: r.comentario_privado,
    respuesta_anfitrion: r.respuesta_anfitrion,
    idioma: r.idioma,
    raw: r.raw,
  };
}

const COMPARABLES = [
  "airbnb_listing_id",
  "depto_id",
  "reserva_id",
  "anuncio_raw",
  "huesped_nombre",
  "fecha_checkin",
  "fecha_checkout",
  "puntaje_general",
  ...CATEGORIAS.map((c) => `puntaje_${c}` as const),
  "resena_publica",
  "comentario_privado",
  "respuesta_anfitrion",
  "idioma",
] as const satisfies readonly (keyof CamposResena)[];

/**
 * Qué queda cuando la reseña ya estaba cargada (CLAUDE.md regla 4):
 * **un valor vacío nunca pisa uno cargado**. Lo que trae el Excel gana solo
 * cuando trae algo. Vale también para el departamento y la reserva: si hoy no
 * se encuentra la reserva que ayer sí, se queda la de ayer.
 *
 * `cambia` dice si hay que escribir. `raw` no cuenta: es el respaldo de la
 * fila y cambia con cualquier cosa.
 */
export function fusionar(
  existente: Pick<FilaResena, (typeof COMPARABLES)[number] | "raw"> | null,
  nueva: CamposResena,
): { fila: CamposResena; cambia: boolean } {
  if (!existente) return { fila: nueva, cambia: true };

  const fila = { ...nueva } as Record<string, unknown>;
  let cambia = false;
  for (const campo of COMPARABLES) {
    const valorNuevo = nueva[campo];
    const valorViejo = existente[campo];
    const vacio = valorNuevo === null || valorNuevo === undefined || valorNuevo === "";
    if (vacio) {
      fila[campo] = valorViejo;
    } else if (valorNuevo !== valorViejo) {
      cambia = true;
    }
  }
  return { fila: fila as CamposResena, cambia };
}
