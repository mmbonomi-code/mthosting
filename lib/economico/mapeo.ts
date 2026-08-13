/**
 * Cruce anuncio → departamento para la sección económica (spec §3).
 *
 * NO hay un mapeo paralelo: la fuente de verdad es `listing_alias`, la misma
 * tabla que ya usan las reservas. Acá solo se le agrega tolerancia, porque los
 * exports de Ganancias traen los títulos con acentos rotos y con mayúsculas
 * cambiadas donde el de reservas los trae limpios.
 */

import { normalizarTexto } from "./parser";

export type Alias = { nombre_listing: string; depto_id: string };

export type MapaAnuncios = {
  /** Devuelve el departamento del anuncio, o null si todavía no está mapeado. */
  resolver: (anuncio: string | null) => string | null;
  /** Anuncios distintos que resuelven al mismo texto normalizado. */
  ambiguos: string[];
};

/**
 * Arma el buscador: exacto primero, normalizado después.
 *
 * Si dos anuncios distintos normalizan igual pero apuntan a departamentos
 * distintos, el normalizado NO se usa para ese texto: imputar la plata al
 * departamento equivocado es peor que dejarla en la bandeja.
 */
export function armarMapa(aliases: Alias[]): MapaAnuncios {
  const exacto = new Map<string, string>();
  const normalizado = new Map<string, string>();
  const ambiguos: string[] = [];

  for (const a of aliases) exacto.set(a.nombre_listing, a.depto_id);

  for (const a of aliases) {
    const clave = normalizarTexto(a.nombre_listing);
    const previo = normalizado.get(clave);
    if (previo === undefined) {
      normalizado.set(clave, a.depto_id);
    } else if (previo !== a.depto_id) {
      normalizado.set(clave, "");
      ambiguos.push(a.nombre_listing);
    }
  }

  return {
    resolver(anuncio) {
      if (anuncio === null || anuncio.trim() === "") return null;
      const directo = exacto.get(anuncio);
      if (directo !== undefined) return directo;
      const aproximado = normalizado.get(normalizarTexto(anuncio));
      return aproximado === undefined || aproximado === "" ? null : aproximado;
    },
    ambiguos,
  };
}
