/**
 * Reglas de la coordinación de check-in / check-out (spec §2.9 y §3.5.bis).
 * Funciones puras, con tests: no tocan la base.
 */

export type EstadoLimpieza =
  | "pendiente"
  | "asignada"
  | "en_curso"
  | "hecha"
  | "verificada"
  | "cancelada";

/** Estados en los que ya hay alguien trabajando: el sistema no los toca. */
const EN_MARCHA: ReadonlySet<EstadoLimpieza> = new Set([
  "en_curso",
  "hecha",
  "verificada",
]);

/** Una limpieza terminada deja el departamento listo. */
const TERMINADAS: ReadonlySet<EstadoLimpieza> = new Set(["hecha", "verificada"]);

/**
 * ¿El departamento está listo para el huésped que llega? (spec §3.5.bis)
 *
 * Lo está si hay una limpieza TERMINADA cuya fecha caiga entre el último
 * check-out y esta llegada. El tiempo transcurrido no importa: si se limpió
 * el lunes y el huésped entra el jueves, sigue listo. Lo que sí importa es
 * que no haya habido otra salida en el medio, porque entonces hace falta
 * una limpieza posterior a ESA salida.
 */
export function departamentoListo({
  limpiezas,
  ultimoCheckout,
  fechaLlegada,
}: {
  limpiezas: { fecha: string; estado: EstadoLimpieza }[];
  /** Fecha del último check-out del departamento anterior a esta llegada. */
  ultimoCheckout: string | null;
  fechaLlegada: string;
}): boolean {
  const desde = ultimoCheckout ?? "0000-01-01";
  return limpiezas.some(
    (l) => TERMINADAS.has(l.estado) && l.fecha >= desde && l.fecha <= fechaLlegada,
  );
}

/**
 * Clave para ordenar los movimientos de un día de más temprano a más tarde.
 *
 * El orden se hace por el momento REAL acordado, no por la hora suelta: un
 * check-in coordinado a las 02:00 del día siguiente sucede después de uno de
 * las 21:30 de hoy, y tiene que aparecer al final. Lo que todavía no tiene
 * hora va último dentro de su día, porque no hay con qué ubicarlo.
 */
export function momentoDeEvento({
  fechaCoordinada,
  horaCoordinada,
  fechaContractual,
}: {
  fechaCoordinada: string | null;
  horaCoordinada: string | null;
  /** La fecha que marca Airbnb: check-in o check-out según el tipo. */
  fechaContractual: string | null;
}): string {
  const fecha = fechaCoordinada ?? fechaContractual ?? "9999-12-31";
  const hora = horaCoordinada ? horaCoordinada.slice(0, 5) : "99:99";
  return `${fecha} ${hora}`;
}

export type DecisionLate =
  | { accion: "mover"; nuevaFecha: string; aviso: string }
  | { accion: "conflicto"; motivo: string }
  | { accion: "nada" };

/**
 * Qué hacer con la limpieza al marcar late check-out (spec §2.9).
 *
 * Marcar late significa que ese día el departamento NO se puede limpiar.
 *   - Sin check-in ese día: la limpieza se mueve al día siguiente. Es el
 *     único movimiento automático del sistema, porque hay un solo destino
 *     posible.
 *   - Con check-in ese día: el sistema NO decide. Late a las 14 con alguien
 *     entrando a las 15 lo resuelve una persona.
 */
export function decidirLateCheckout({
  fechaCheckout,
  hayCheckinEseDia,
  limpieza,
}: {
  fechaCheckout: string;
  hayCheckinEseDia: boolean;
  limpieza: { id: string; fecha: string; estado: EstadoLimpieza } | null;
}): DecisionLate {
  if (hayCheckinEseDia) {
    return {
      accion: "conflicto",
      motivo:
        "Hay un huésped entrando ese mismo día. La limpieza no se movió: hay que resolverlo con las personas involucradas.",
    };
  }

  if (!limpieza || limpieza.estado === "cancelada") return { accion: "nada" };

  if (EN_MARCHA.has(limpieza.estado)) {
    return {
      accion: "conflicto",
      motivo: `La limpieza ya está ${limpieza.estado}: no se movió sola.`,
    };
  }

  // Solo se mueve si estaba planificada para el día del check-out.
  if (limpieza.fecha !== fechaCheckout) return { accion: "nada" };

  const nuevaFecha = sumarUnDia(fechaCheckout);
  return {
    accion: "mover",
    nuevaFecha,
    aviso: `La limpieza se movió del ${fechaCheckout} al ${nuevaFecha}.`,
  };
}

function sumarUnDia(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d + 1)).toISOString().slice(0, 10);
}

/**
 * La ventana entre la salida de un huésped y la llegada del siguiente, para
 * no acordar un horario imposible mientras se coordina (spec §3.1).
 * Devuelve null si falta alguno de los dos horarios.
 */
export function ventanaDisponible(
  horaSalida: string | null,
  horaEntrada: string | null,
): string | null {
  if (!horaSalida || !horaEntrada) return null;
  return `${horaSalida.slice(0, 5)} a ${horaEntrada.slice(0, 5)}`;
}

/**
 * Alerta de ventana insuficiente (spec §2.8.quater): salida tarde y entrada
 * temprano el MISMO DÍA hacen imposible limpiar. Los umbrales son
 * configuración, no valores fijos.
 *
 * Las fechas son obligatorias a propósito, no un adorno: sin ellas, comparar
 * solo las horas del reloj confunde "salió tarde hoy" con "salió hace cuatro
 * días". Un check-out del 17/8 a las 18:00 y un check-in del 21/8 a las 15:00
 * disparaba "imposible limpiar" porque 15:00 ≤ 18:00, aunque hay cuatro días
 * de por medio (caso real, MARCELO VIANNA en AUSTRIA 1, 20/08/2026). La regla
 * de la ventana insuficiente es solo para el recambio el mismo día; en
 * cualquier otro caso no aplica, así que ni se evalúa.
 *
 * Tampoco aplica cuando la llegada temprana es SOLO para dejar las valijas
 * (decisión del dueño, 29/08/2026). Una llegada a las 10:30 con acceso de
 * método "valijas" no es el huésped entrando: en Talcahuano las valijas
 * quedan en un lugar del edificio, y si no, se las deja a la limpieza. El
 * departamento no queda ocupado y la limpieza avanza igual, así que esa hora
 * no acorta ninguna ventana.
 */
export function ventanaInsuficiente({
  fechaSalida,
  horaSalida,
  fechaEntrada,
  horaEntrada,
  horaLimiteCheckout,
  horaMinimaCheckin,
  entradaSoloValijas = false,
}: {
  fechaSalida: string | null;
  horaSalida: string | null;
  fechaEntrada: string | null;
  horaEntrada: string | null;
  horaLimiteCheckout: string;
  horaMinimaCheckin: string;
  /** La llegada es una entrega de valijas, no el huésped entrando. */
  entradaSoloValijas?: boolean;
}): boolean {
  if (entradaSoloValijas) return false;
  if (!horaSalida || !horaEntrada) return false;
  // Sin las dos fechas no se puede saber si es el mismo día: mejor no
  // alertar que alertar con un falso positivo.
  if (!fechaSalida || !fechaEntrada || fechaSalida !== fechaEntrada) return false;

  const salida = horaSalida.slice(0, 5);
  const entrada = horaEntrada.slice(0, 5);

  // Entrar antes (o justo cuando) sale el anterior es imposible, sin importar
  // los umbrales: el huésped nuevo llegaría con el viejo todavía adentro.
  if (entrada <= salida) return true;

  return (
    salida > horaLimiteCheckout.slice(0, 5) && entrada < horaMinimaCheckin.slice(0, 5)
  );
}
