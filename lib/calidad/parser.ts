/**
 * Leer el Excel de reseñas de Airbnb (docs/CALIDAD-ESPECIFICACION.md §2.1).
 *
 * Funciones PURAS: reciben las filas como texto (lib/importador/xlsx.ts) y
 * devuelven reseñas listas para cruzar con la base. No tocan nada.
 *
 * Una fila con un problema (fecha ilegible, puntaje fuera de 1-5, sin ID) no
 * frena el archivo: se informa con su número de fila y el resto sigue. Lo que
 * sí frena todo es que falte una columna obligatoria, porque entonces el
 * archivo no es el que creemos.
 */

export const CATEGORIAS = [
  "limpieza",
  "veracidad",
  "checkin",
  "comunicacion",
  "ubicacion",
  "precio",
] as const;

export type Categoria = (typeof CATEGORIAS)[number];
export type Signo = "positiva" | "negativa" | "otro";

export type Etiqueta = { categoria: Categoria; signo: Signo; texto: string };

export type ResenaParseada = {
  /** Número de fila en el Excel (1 = encabezado), para los avisos. */
  fila: number;
  airbnb_resena_id: string;
  airbnb_listing_id: string;
  anuncio_raw: string | null;
  huesped_nombre: string | null;
  fecha_checkin: string;
  fecha_checkout: string;
  puntaje_general: number;
  /** Null = la celda vino vacía (no "cero"). */
  puntajes: Record<Categoria, number | null>;
  /**
   * Etiquetas por categoría. Una categoría AUSENTE del objeto = su columna vino
   * vacía; presente con lista vacía no pasa (si la celda tiene texto, hay al
   * menos una etiqueta).
   */
  etiquetas: Partial<Record<Categoria, Etiqueta[]>>;
  resena_publica: string | null;
  comentario_privado: string | null;
  respuesta_anfitrion: string | null;
  idioma: string | null;
  /** La fila tal como vino, por encabezado. Va a `resenas.raw`. */
  raw: Record<string, string>;
};

export type FilaRechazada = { fila: number; motivo: string };

export type ResultadoParser = {
  resenas: ResenaParseada[];
  rechazadas: FilaRechazada[];
};

export class ErrorArchivoResenas extends Error {}

// ---------------------------------------------------------------------------
// Encabezados
// ---------------------------------------------------------------------------

/** Minúsculas, sin tildes ni signos: "Pt. Comunicación" → "pt comunicacion". */
export function normalizarEncabezado(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Nombre del archivo de Airbnb (normalizado) → campo. */
const COLUMNAS = {
  resena_id: "id resena",
  listing_id: "id anuncio",
  anuncio: "anuncio",
  huesped: "huesped",
  checkin: "check in",
  checkout: "check out",
  general: "puntaje general",
  resena_publica: "resena publica",
  comentario_privado: "comentario privado",
  respuesta: "respuesta anfitrion",
  idioma: "idioma",
} as const;

/** Cómo se llama cada categoría en los encabezados del archivo. */
const NOMBRE_CATEGORIA: Record<Categoria, string> = {
  limpieza: "limpieza",
  veracidad: "veracidad",
  checkin: "check in",
  comunicacion: "comunicacion",
  ubicacion: "ubicacion",
  precio: "precio calidad",
};

const OBLIGATORIAS = ["resena_id", "listing_id", "checkin", "checkout", "general"] as const;

type Indices = {
  [K in keyof typeof COLUMNAS]: number;
} & {
  puntaje: Record<Categoria, number>;
  etiquetas: Record<Categoria, number>;
};

function ubicarColumnas(encabezado: string[]): Indices {
  const normal = encabezado.map(normalizarEncabezado);
  const buscar = (nombre: string) => normal.indexOf(nombre);

  const indices = {
    puntaje: {} as Record<Categoria, number>,
    etiquetas: {} as Record<Categoria, number>,
  } as Indices;
  for (const [campo, nombre] of Object.entries(COLUMNAS)) {
    (indices as Record<string, unknown>)[campo] = buscar(nombre);
  }
  for (const c of CATEGORIAS) {
    indices.puntaje[c] = buscar(`pt ${NOMBRE_CATEGORIA[c]}`);
    indices.etiquetas[c] = buscar(`etiquetas ${NOMBRE_CATEGORIA[c]}`);
  }

  const faltan = OBLIGATORIAS.filter((campo) => indices[campo] < 0).map(
    (campo) => COLUMNAS[campo],
  );
  if (faltan.length > 0) {
    throw new ErrorArchivoResenas(
      `No parece el Excel de reseñas: faltan las columnas ${faltan
        .map((f) => `"${f}"`)
        .join(", ")}.`,
    );
  }
  return indices;
}

// ---------------------------------------------------------------------------
// Valores
// ---------------------------------------------------------------------------

/** Día 0 de las fechas de Excel (con el error del año 1900 incluido). */
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);

function fechaValida(a: number, m: number, d: number): string | null {
  const f = new Date(Date.UTC(a, m - 1, d));
  if (f.getUTCFullYear() !== a || f.getUTCMonth() !== m - 1 || f.getUTCDate() !== d) {
    return null;
  }
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Una fecha de negocio como `AAAA-MM-DD`, o null si no se entiende.
 *
 * Acepta las tres formas en que llega: fecha de Excel ya convertida
 * (`2026-10-02`), texto argentino (`02/10/2026`) y el número de serie de
 * Excel cuando la celda no tiene formato de fecha (`46297`). Nunca pasa por
 * `new Date(texto)`, que interpretaría `02/10` como 10 de febrero.
 */
export function parsearFecha(texto: string): string | null {
  const t = texto.trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return fechaValida(+m[1], +m[2], +m[3]);

  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return fechaValida(+m[3], +m[2], +m[1]);

  // Número de serie: solo enteros en un rango razonable (años 2000 a 2100).
  if (/^\d{5}$/.test(t)) {
    const serie = Number(t);
    if (serie >= 36526 && serie <= 73051) {
      return new Date(EPOCA_EXCEL + serie * 86_400_000).toISOString().slice(0, 10);
    }
  }
  return null;
}

/** Puntaje 1 a 5. `null` si la celda está vacía; `undefined` si es inválido. */
export function parsearPuntaje(texto: string): number | null | undefined {
  const t = texto.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  if (!Number.isInteger(n) || n < 1 || n > 5) return undefined;
  return n;
}

/**
 * Las etiquetas de una celda: una por línea.
 *
 *   "(+) Estaba organizado."  → positiva, "Estaba organizado"
 *   "(-) Había manchas."      → negativa, "Había manchas"
 *   "Otro: Me permitió..."    → otro,     "Me permitió..."
 *
 * Se saca el punto final porque Airbnb lo pone a veces sí y a veces no en la
 * misma etiqueta, y para contarlas tienen que ser iguales. Una línea repetida
 * en la misma celda cuenta una vez.
 */
export function parsearEtiquetas(categoria: Categoria, celda: string): Etiqueta[] {
  const vistas = new Set<string>();
  const etiquetas: Etiqueta[] = [];
  for (const linea of celda.split(/\r?\n/)) {
    let l = linea.trim();
    if (l === "") continue;

    let signo: Signo;
    if (l.startsWith("(+)")) {
      signo = "positiva";
      l = l.slice(3);
    } else if (l.startsWith("(-)")) {
      signo = "negativa";
      l = l.slice(3);
    } else if (/^otro\s*:/i.test(l)) {
      signo = "otro";
      l = l.replace(/^otro\s*:/i, "");
    } else {
      signo = "otro";
    }

    const texto = l.trim().replace(/\.+$/, "").trim();
    if (texto === "") continue;
    const clave = `${signo}|${texto}`;
    if (vistas.has(clave)) continue;
    vistas.add(clave);
    etiquetas.push({ categoria, signo, texto });
  }
  return etiquetas;
}

const textoONull = (t: string | undefined) => {
  const v = (t ?? "").trim();
  return v === "" ? null : v;
};

// ---------------------------------------------------------------------------
// El archivo
// ---------------------------------------------------------------------------

export function parsearResenas(filas: string[][]): ResultadoParser {
  // El encabezado es la primera fila con algo escrito.
  const inicio = filas.findIndex((f) => f.some((c) => c.trim() !== ""));
  if (inicio < 0) throw new ErrorArchivoResenas("El archivo está vacío.");

  const encabezado = filas[inicio];
  const col = ubicarColumnas(encabezado);
  const celda = (fila: string[], i: number) => (i >= 0 ? (fila[i] ?? "") : "");

  const resenas: ResenaParseada[] = [];
  const rechazadas: FilaRechazada[] = [];
  const idsVistos = new Map<string, number>();

  for (let i = inicio + 1; i < filas.length; i++) {
    const fila = filas[i];
    const numero = i + 1;
    if (!fila || fila.every((c) => c.trim() === "")) continue;

    const rechazar = (motivo: string) => rechazadas.push({ fila: numero, motivo });

    const id = celda(fila, col.resena_id).trim();
    if (id === "") {
      rechazar("Sin ID de reseña.");
      continue;
    }
    const anterior = idsVistos.get(id);
    if (anterior !== undefined) {
      rechazar(`La reseña ${id} ya está en la fila ${anterior}.`);
      continue;
    }

    const listing = celda(fila, col.listing_id).trim();
    if (listing === "") {
      rechazar("Sin ID de anuncio.");
      continue;
    }

    const checkin = parsearFecha(celda(fila, col.checkin));
    const checkout = parsearFecha(celda(fila, col.checkout));
    if (!checkin || !checkout) {
      rechazar(
        `Fecha ilegible: check-in "${celda(fila, col.checkin)}", check-out "${celda(fila, col.checkout)}".`,
      );
      continue;
    }
    if (checkout <= checkin) {
      rechazar(`El check-out (${checkout}) no es posterior al check-in (${checkin}).`);
      continue;
    }

    const general = parsearPuntaje(celda(fila, col.general));
    if (general === null || general === undefined) {
      rechazar(`Puntaje general inválido: "${celda(fila, col.general)}".`);
      continue;
    }

    const puntajes = {} as Record<Categoria, number | null>;
    let malo: string | null = null;
    for (const c of CATEGORIAS) {
      const p = parsearPuntaje(celda(fila, col.puntaje[c]));
      if (p === undefined) malo = `Puntaje de ${c} inválido: "${celda(fila, col.puntaje[c])}".`;
      puntajes[c] = p ?? null;
    }
    if (malo) {
      rechazar(malo);
      continue;
    }

    const etiquetas: Partial<Record<Categoria, Etiqueta[]>> = {};
    for (const c of CATEGORIAS) {
      const lista = parsearEtiquetas(c, celda(fila, col.etiquetas[c]));
      if (lista.length > 0) etiquetas[c] = lista;
    }

    const raw: Record<string, string> = {};
    encabezado.forEach((h, j) => {
      if (h.trim() !== "" && (fila[j] ?? "") !== "") raw[h.trim()] = fila[j];
    });

    idsVistos.set(id, numero);
    resenas.push({
      fila: numero,
      airbnb_resena_id: id,
      airbnb_listing_id: listing,
      anuncio_raw: textoONull(celda(fila, col.anuncio)),
      huesped_nombre: textoONull(celda(fila, col.huesped)),
      fecha_checkin: checkin,
      fecha_checkout: checkout,
      puntaje_general: general,
      puntajes,
      etiquetas,
      resena_publica: textoONull(celda(fila, col.resena_publica)),
      comentario_privado: textoONull(celda(fila, col.comentario_privado)),
      respuesta_anfitrion: textoONull(celda(fila, col.respuesta)),
      idioma: textoONull(celda(fila, col.idioma)),
      raw,
    });
  }

  return { resenas, rechazadas };
}
