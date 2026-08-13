/**
 * Alarmas sobre las limpiezas ya generadas (decisiones del dueño, 13/08/2026).
 *
 * Funciones PURAS: reciben lo que hay y devuelven qué está raro. No arreglan
 * nada — avisan. La diferencia importa: una limpieza que cae en el medio de
 * una estadía puede estar perfecta (un cambio de blancos pedido por el
 * huésped) o ser un error grave (limpiar con gente adentro sin saberlo). El
 * sistema no puede decidir cuál de las dos es.
 */

export type LimpiezaRevisar = {
  id: string;
  depto_id: string;
  fecha: string;
  tipo: string;
  estado: string;
};

export type EstadiaRevisar = {
  depto_id: string | null;
  codigo_reserva: string;
  fecha_checkin: string | null;
  fecha_checkout: string | null;
  cancelada: boolean;
  descartada: boolean;
};

export type Alerta = {
  limpieza_id: string;
  depto_id: string;
  fecha: string;
  motivo: "en_medio_de_estadia" | "dos_el_mismo_dia";
  detalle: string;
};

/** Las que ya no cuentan para nada: canceladas. */
const VIVA = (l: LimpiezaRevisar) => l.estado !== "cancelada";

/**
 * Limpiezas que caen DENTRO de una estadía y no están marcadas como limpieza
 * con huéspedes.
 *
 * "Dentro" es estricto: el día de entrada y el de salida no cuentan, porque
 * ahí la limpieza es justamente lo normal. Solo alarma un día en el que hay
 * alguien durmiendo en el departamento antes y después.
 */
export function limpiezasEnMedioDeEstadia(
  limpiezas: LimpiezaRevisar[],
  reservas: EstadiaRevisar[],
): Alerta[] {
  const porDepto = new Map<string, EstadiaRevisar[]>();
  for (const r of reservas) {
    if (!r.depto_id || r.cancelada || r.descartada) continue;
    if (!r.fecha_checkin || !r.fecha_checkout) continue;
    porDepto.set(r.depto_id, [...(porDepto.get(r.depto_id) ?? []), r]);
  }

  const alertas: Alerta[] = [];
  for (const l of limpiezas.filter(VIVA)) {
    // Una limpieza con huéspedes adentro es a propósito: no se avisa.
    if (l.tipo === "con_huespedes") continue;

    const encima = (porDepto.get(l.depto_id) ?? []).find(
      (r) => r.fecha_checkin! < l.fecha && l.fecha < r.fecha_checkout!,
    );
    if (!encima) continue;

    alertas.push({
      limpieza_id: l.id,
      depto_id: l.depto_id,
      fecha: l.fecha,
      motivo: "en_medio_de_estadia",
      detalle:
        `Cae en el medio de la estadía de ${encima.codigo_reserva} ` +
        `(${encima.fecha_checkin} a ${encima.fecha_checkout}) y no está marcada como ` +
        `limpieza con huéspedes. O el tipo está mal, o la limpieza no va.`,
    });
  }
  return alertas;
}

/**
 * Departamentos con más de una limpieza viva el mismo día.
 *
 * No puede pasar (decisión del dueño): o sobra una, o hay dos reservas
 * pisadas en el mismo departamento, que es el problema de fondo.
 */
export function dosLimpiezasElMismoDia(limpiezas: LimpiezaRevisar[]): Alerta[] {
  const porDeptoFecha = new Map<string, LimpiezaRevisar[]>();
  for (const l of limpiezas.filter(VIVA)) {
    const clave = `${l.depto_id}|${l.fecha}`;
    porDeptoFecha.set(clave, [...(porDeptoFecha.get(clave) ?? []), l]);
  }

  const alertas: Alerta[] = [];
  for (const [, grupo] of porDeptoFecha) {
    if (grupo.length < 2) continue;
    for (const l of grupo) {
      alertas.push({
        limpieza_id: l.id,
        depto_id: l.depto_id,
        fecha: l.fecha,
        motivo: "dos_el_mismo_dia",
        detalle: `Ese día el departamento tiene ${grupo.length} limpiezas. Tiene que quedar una sola.`,
      });
    }
  }
  return alertas;
}

/** Todas las alarmas juntas, indexadas por limpieza para pintarlas en la lista. */
export function revisarLimpiezas(
  limpiezas: LimpiezaRevisar[],
  reservas: EstadiaRevisar[],
): Map<string, Alerta[]> {
  const todas = [
    ...dosLimpiezasElMismoDia(limpiezas),
    ...limpiezasEnMedioDeEstadia(limpiezas, reservas),
  ];
  const porLimpieza = new Map<string, Alerta[]>();
  for (const a of todas) {
    porLimpieza.set(a.limpieza_id, [...(porLimpieza.get(a.limpieza_id) ?? []), a]);
  }
  return porLimpieza;
}
