/**
 * Los números de Calidad por departamento (docs/CALIDAD-ESPECIFICACION.md
 * §3.6 y §5.1).
 *
 * PURA: recibe las reseñas del período, sus quejas, las estadías terminadas y
 * devuelve promedios, tasa de reseñas y quejas más repetidas. Una sola pasada
 * por cada lista: nada de recorrer todo por cada fila.
 */

import { firmaAlerta, motivoAlerta } from "./alertas";
import { CATEGORIAS, type Categoria } from "./parser";

export type ResenaResumen = {
  id: string;
  depto_id: string | null;
  reserva_id: string | null;
  puntaje_general: number;
  puntajes: Record<Categoria, number | null>;
};

export type Queja = { resena_id: string; categoria: Categoria; texto: string };

/** Una estadía terminada que podía tener reseña (§3.6). */
export type Estadia = { id: string; depto_id: string };

export type Promedios = {
  resenas: number;
  general: number | null;
  categorias: Record<Categoria, number | null>;
  /** Porcentaje de reseñas con 5 estrellas generales (0 a 100). */
  cinco: number | null;
};

export type Tasa = { conResena: number; estadias: number; pct: number | null };

export type FilaDepto = Promedios & {
  depto_id: string;
  codigo: string;
  tasa: Tasa;
  quejaMasRepetida: { texto: string; veces: number } | null;
  /** Reseñas que cumplen la regla de alerta y no se dieron por revisadas. */
  alertas: number;
};

export type ResumenCalidad = {
  total: Promedios & { tasa: Tasa; alertas: number };
  deptos: FilaDepto[];
  quejas: { categoria: Categoria; texto: string; veces: number }[];
};

/** Con menos reseñas que esto, un promedio no dice mucho y se muestra apagado. */
export const MINIMO_RESENAS_CONFIABLE = 3;
/** Una categoría por debajo de esto se marca para mirar. */
export const UMBRAL_CATEGORIA_FLOJA = 4.5;

type Acumulador = {
  n: number;
  general: number;
  cinco: number;
  cat: Record<Categoria, { suma: number; n: number }>;
  alertas: number;
};

function nuevoAcumulador(): Acumulador {
  return {
    n: 0,
    general: 0,
    cinco: 0,
    cat: Object.fromEntries(CATEGORIAS.map((c) => [c, { suma: 0, n: 0 }])) as Acumulador["cat"],
    alertas: 0,
  };
}

function cerrar(a: Acumulador): Promedios {
  return {
    resenas: a.n,
    general: a.n ? a.general / a.n : null,
    categorias: Object.fromEntries(
      CATEGORIAS.map((c) => [c, a.cat[c].n ? a.cat[c].suma / a.cat[c].n : null]),
    ) as Record<Categoria, number | null>,
    cinco: a.n ? (a.cinco / a.n) * 100 : null,
  };
}

function tasa(conResena: number, estadias: number): Tasa {
  return { conResena, estadias, pct: estadias ? (conResena / estadias) * 100 : null };
}

export function resumirCalidad(datos: {
  resenas: ResenaResumen[];
  quejas: Queja[];
  /** Firma revisada por reseña (`resena_revisada`). */
  revisadas: Map<string, string>;
  estadias: Estadia[];
  deptos: { id: string; codigo: string }[];
}): ResumenCalidad {
  const quejasDe = new Map<string, Queja[]>();
  for (const q of datos.quejas) quejasDe.set(q.resena_id, [...(quejasDe.get(q.resena_id) ?? []), q]);

  const total = nuevoAcumulador();
  const porDepto = new Map<string, Acumulador>();
  const quejasDepto = new Map<string, Map<string, number>>();
  const quejasTotal = new Map<string, { categoria: Categoria; texto: string; veces: number }>();
  const reservasConResena = new Set<string>();

  for (const r of datos.resenas) {
    if (r.reserva_id) reservasConResena.add(r.reserva_id);
    const propias = quejasDe.get(r.id) ?? [];
    const negativas = propias.map((q) => q.texto);

    const acums = [total];
    if (r.depto_id) {
      if (!porDepto.has(r.depto_id)) porDepto.set(r.depto_id, nuevoAcumulador());
      acums.push(porDepto.get(r.depto_id)!);
    }

    const alerta = { puntaje_general: r.puntaje_general, puntajes: r.puntajes, negativas };
    const abierta =
      motivoAlerta(alerta) !== null && datos.revisadas.get(r.id) !== firmaAlerta(alerta);

    for (const a of acums) {
      a.n++;
      a.general += r.puntaje_general;
      if (r.puntaje_general === 5) a.cinco++;
      for (const c of CATEGORIAS) {
        const p = r.puntajes[c];
        if (p !== null) {
          a.cat[c].suma += p;
          a.cat[c].n++;
        }
      }
      if (abierta) a.alertas++;
    }

    for (const q of propias) {
      const clave = `${q.categoria}|${q.texto}`;
      const t = quejasTotal.get(clave) ?? { categoria: q.categoria, texto: q.texto, veces: 0 };
      t.veces++;
      quejasTotal.set(clave, t);
      if (r.depto_id) {
        const m = quejasDepto.get(r.depto_id) ?? new Map<string, number>();
        m.set(q.texto, (m.get(q.texto) ?? 0) + 1);
        quejasDepto.set(r.depto_id, m);
      }
    }
  }

  // Tasa: cuántas estadías terminadas tienen su reseña.
  const estadiasDe = new Map<string, { con: number; total: number }>();
  let conTotal = 0;
  for (const e of datos.estadias) {
    const t = estadiasDe.get(e.depto_id) ?? { con: 0, total: 0 };
    t.total++;
    if (reservasConResena.has(e.id)) {
      t.con++;
      conTotal++;
    }
    estadiasDe.set(e.depto_id, t);
  }

  const codigoDe = new Map(datos.deptos.map((d) => [d.id, d.codigo]));
  const ids = new Set([...porDepto.keys(), ...estadiasDe.keys()]);
  const deptos: FilaDepto[] = [...ids]
    .filter((id) => codigoDe.has(id))
    .map((id) => {
      const a = porDepto.get(id) ?? nuevoAcumulador();
      const e = estadiasDe.get(id) ?? { con: 0, total: 0 };
      const masRepetida = [...(quejasDepto.get(id) ?? new Map()).entries()].sort(
        (x, y) => y[1] - x[1] || x[0].localeCompare(y[0]),
      )[0];
      return {
        depto_id: id,
        codigo: codigoDe.get(id)!,
        ...cerrar(a),
        tasa: tasa(e.con, e.total),
        quejaMasRepetida: masRepetida ? { texto: masRepetida[0], veces: masRepetida[1] } : null,
        alertas: a.alertas,
      };
    })
    // De peor a mejor. Sin reseñas, al final.
    .sort((x, y) => {
      if (x.general === null) return y.general === null ? x.codigo.localeCompare(y.codigo) : 1;
      if (y.general === null) return -1;
      return x.general - y.general || x.codigo.localeCompare(y.codigo);
    });

  return {
    total: { ...cerrar(total), tasa: tasa(conTotal, datos.estadias.length), alertas: total.alertas },
    deptos,
    quejas: [...quejasTotal.values()].sort((a, b) => b.veces - a.veces || a.texto.localeCompare(b.texto)),
  };
}
