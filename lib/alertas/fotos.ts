/**
 * Las alertas que nacen de las fotos que saca el personal de limpieza.
 *
 * De las cuatro categorías de foto (lib/limpiezas/fotos.ts), dos son un
 * pedido de acción y hasta ahora no le avisaban a nadie:
 *
 * - `huesped` — lo que el huésped dejó mal: algo roto, blanquería manchada,
 *   suciedad fuera de lo normal. Puede terminar en un reclamo a Airbnb, y
 *   Airbnb da 14 días. Si nadie mira la ficha de esa limpieza, el plazo se
 *   vence solo.
 * - `olvido` — lo que el huésped se olvidó. Es el más urgente de todos: la
 *   persona ya se fue del país y quiere su cargador.
 *
 * Las alertas son POR LIMPIEZA, no por foto (decisión del dueño,
 * 02/09/2026): cinco fotos del mismo desastre son un solo problema, y se dan
 * por revisadas de un solo toque.
 */

/** Las dos categorías de foto que encienden una alerta. */
export type ClaseAlertaFoto = "huesped" | "olvido";

export type FotoCruda = {
  limpieza_id: string;
  tipo: string | null;
  created_at: string;
};

export type LimpiezaDeFoto = {
  id: string;
  depto_id: string;
  fecha: string;
  tipo: string;
  rol_reserva: "salida" | "entrada" | "durante" | null;
  reserva_id: string | null;
};

export type RevisadaCruda = {
  clase: string;
  limpieza_id: string;
  firma: string;
};

export type AlertaFotos = {
  limpieza_id: string;
  depto_id: string;
  fecha: string;
  /** Cuántas fotos de esa categoría hay en esa limpieza. */
  cantidad: number;
  /** Lo que hay que guardar si alguien da esto por revisado. */
  firma: string;
};

/**
 * Qué se está dando por revisado: cuántas fotos había y cuál era la última.
 *
 * No alcanza con un "ya lo vi": si mañana la misma limpieza suma otra foto
 * de olvido, la firma cambia y la alerta tiene que volver. Con un booleano,
 * apagarla una vez la apagaba para siempre y la segunda foto quedaba
 * invisible — que es exactamente el problema que estas alertas vienen a
 * resolver.
 */
export function firmaFotos(fotos: { created_at: string }[]): string {
  if (fotos.length === 0) return "0|";
  const ultima = fotos.reduce((a, b) => (a.created_at >= b.created_at ? a : b));
  return `${fotos.length}|${ultima.created_at}`;
}

/**
 * Una alerta por limpieza que tenga fotos de esa categoría y no esté dada
 * por revisada con esa misma firma.
 */
export function alertasDeFotos(
  clase: ClaseAlertaFoto,
  fotos: FotoCruda[],
  limpiezas: LimpiezaDeFoto[],
  revisadas: RevisadaCruda[],
): AlertaFotos[] {
  const porLimpieza = new Map<string, FotoCruda[]>();
  for (const f of fotos) {
    if (f.tipo !== clase) continue;
    const previas = porLimpieza.get(f.limpieza_id);
    if (previas) previas.push(f);
    else porLimpieza.set(f.limpieza_id, [f]);
  }

  const firmaRevisada = new Map(
    revisadas.filter((r) => r.clase === clase).map((r) => [r.limpieza_id, r.firma]),
  );
  const limpiezaPorId = new Map(limpiezas.map((l) => [l.id, l]));

  const alertas: AlertaFotos[] = [];
  for (const [limpiezaId, suyas] of porLimpieza) {
    const limpieza = limpiezaPorId.get(limpiezaId);
    if (!limpieza) continue;
    const firma = firmaFotos(suyas);
    if (firmaRevisada.get(limpiezaId) === firma) continue;
    alertas.push({
      limpieza_id: limpiezaId,
      depto_id: limpieza.depto_id,
      fecha: limpieza.fecha,
      cantidad: suyas.length,
      firma,
    });
  }

  // La más vieja primero: es la que lleva más tiempo esperando, y en los
  // daños es la que tiene el plazo de Airbnb más cerca de vencerse.
  return alertas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

// ---------------------------------------------------------------------------
// A quién se le reclama
// ---------------------------------------------------------------------------

export type ReservaDelDepto = {
  id: string;
  codigo_reserva: string;
  depto_id: string;
  fecha_checkin: string;
  fecha_checkout: string;
};

/** Limpieza con huéspedes adentro: el daño es del que TODAVÍA está. */
const CON_HUESPEDES = "con_huespedes";

/**
 * De qué reserva es el daño que fotografió la limpieza.
 *
 * Regla del dueño (02/09/2026): siempre es la reserva que SALIÓ, salvo que
 * la limpieza sea "con huéspedes" — ahí el departamento no se desocupó, así
 * que el daño es del huésped que está adentro en ese momento.
 *
 * Se prefiere el vínculo que ya guarda la limpieza (`reserva_id` con su
 * `rol_reserva`) porque es la decisión explícita de quien armó la limpieza y
 * sobrevive a los cambios de fecha. Buscar por fecha es el respaldo para las
 * limpiezas que no quedaron atadas a ninguna reserva.
 */
export function reservaAReclamar(
  limpieza: LimpiezaDeFoto,
  reservas: ReservaDelDepto[],
): ReservaDelDepto | null {
  const delDepto = reservas.filter((r) => r.depto_id === limpieza.depto_id);
  const porId = (id: string | null) => (id ? (delDepto.find((r) => r.id === id) ?? null) : null);

  if (limpieza.tipo === CON_HUESPEDES) {
    const vinculada = limpieza.rol_reserva === "durante" ? porId(limpieza.reserva_id) : null;
    if (vinculada) return vinculada;
    // La que tiene el departamento ocupado ese día.
    const ocupando = delDepto.find(
      (r) => r.fecha_checkin <= limpieza.fecha && limpieza.fecha < r.fecha_checkout,
    );
    if (ocupando) return ocupando;
    // Si no hay ninguna ocupando, no se inventa: cae a la regla general.
  }

  const vinculada = limpieza.rol_reserva === "salida" ? porId(limpieza.reserva_id) : null;
  if (vinculada) return vinculada;

  return delDepto.find((r) => r.fecha_checkout === limpieza.fecha) ?? null;
}

// ---------------------------------------------------------------------------
// Algo para arreglar: la foto Y el texto, juntos
// ---------------------------------------------------------------------------

/** La clase con la que se guarda un "revisado" de arreglos. */
export const CLASE_ARREGLO = "arreglo";

/** Un arreglo reportado desde una limpieza y todavía sin resolver. */
export type ArregloDeLimpieza = {
  id: string;
  depto_id: string;
  limpieza_id: string;
  descripcion: string;
  created_at: string;
};

export type AlertaArreglo = {
  limpieza_id: string;
  depto_id: string;
  fecha: string;
  /** Lo que escribió la persona. Puede estar vacío: la foto alcanza. */
  descripciones: string[];
  /** Cuántas fotos de "algo para arreglar" tiene esa limpieza. */
  fotos: number;
  /** Los arreglos que hay que dar por resueltos si se marca revisado. */
  arreglo_ids: string[];
  /** Firma de las fotos, o null si la alerta es solo por texto. */
  firma: string | null;
};

/**
 * Lo que la limpieza reportó para arreglar, UNA alerta por limpieza
 * (decisión del dueño, 02/09/2026): si en el mismo departamento hay tres
 * cosas rotas, es un solo viaje del electricista.
 *
 * Se enciende con lo que llegue primero, la foto o el texto. Antes solo el
 * texto encendía algo: sacar la foto de la persiana rota y no escribir nada
 * dejaba el problema invisible, que es justo lo que pasa cuando alguien está
 * apurado terminando un departamento.
 *
 * Se apaga cuando se resuelven los arreglos Y se dan por vistas las fotos.
 * Si después aparece una foto nueva, la firma cambia y el aviso vuelve.
 */
export function alertasDeArreglos(
  arreglos: ArregloDeLimpieza[],
  fotos: FotoCruda[],
  limpiezas: LimpiezaDeFoto[],
  revisadas: RevisadaCruda[],
): AlertaArreglo[] {
  const limpiezaPorId = new Map(limpiezas.map((l) => [l.id, l]));
  const firmaRevisada = new Map(
    revisadas.filter((r) => r.clase === CLASE_ARREGLO).map((r) => [r.limpieza_id, r.firma]),
  );

  const porLimpieza = new Map<
    string,
    { depto_id: string; fecha: string; arreglos: ArregloDeLimpieza[]; fotos: FotoCruda[] }
  >();

  const asegurar = (limpiezaId: string, deptoId: string, fecha: string) => {
    let fila = porLimpieza.get(limpiezaId);
    if (!fila) {
      const limpieza = limpiezaPorId.get(limpiezaId);
      fila = {
        // La limpieza es la fuente buena; el arreglo es el respaldo para los
        // que quedaron de antes de la ventana de fotos.
        depto_id: limpieza?.depto_id ?? deptoId,
        fecha: limpieza?.fecha ?? fecha,
        arreglos: [],
        fotos: [],
      };
      porLimpieza.set(limpiezaId, fila);
    }
    return fila;
  };

  for (const a of arreglos) {
    asegurar(a.limpieza_id, a.depto_id, a.created_at.slice(0, 10)).arreglos.push(a);
  }

  for (const f of fotos) {
    if (f.tipo !== "arreglar") continue;
    const limpieza = limpiezaPorId.get(f.limpieza_id);
    if (!limpieza) continue;
    asegurar(f.limpieza_id, limpieza.depto_id, limpieza.fecha).fotos.push(f);
  }

  const alertas: AlertaArreglo[] = [];
  for (const [limpiezaId, fila] of porLimpieza) {
    const firma = fila.fotos.length > 0 ? firmaFotos(fila.fotos) : null;
    const fotosYaVistas = firma === null || firmaRevisada.get(limpiezaId) === firma;
    // Sin arreglos abiertos y con las fotos ya miradas, no queda nada que
    // avisar. Alcanza con que quede una de las dos cosas.
    if (fila.arreglos.length === 0 && fotosYaVistas) continue;

    alertas.push({
      limpieza_id: limpiezaId,
      depto_id: fila.depto_id,
      fecha: fila.fecha,
      descripciones: fila.arreglos
        .slice()
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
        .map((a) => a.descripcion),
      fotos: fila.fotos.length,
      arreglo_ids: fila.arreglos.map((a) => a.id),
      firma,
    });
  }

  // El más viejo primero: lleva más tiempo roto.
  return alertas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}
