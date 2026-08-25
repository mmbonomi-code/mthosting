/**
 * Cordura del tipo de cambio que se carga a mano (Marcos, 25/08/2026).
 *
 * El dólar de cada día se escribe a mano, y un dígito de menos pasa
 * desapercibido: el 09/06/2026 se cargó `144` en vez de `1440` y los gastos
 * de ese día quedaron valuados en diez veces más dólares de los que fueron.
 * Nadie lo vio hasta que la rentabilidad del mes dio negativa en dólares y
 * positiva en pesos.
 *
 * La defensa es comparar contra lo que se viene cargando alrededor de esa
 * fecha: si el valor nuevo se aparta más de un 10%, se avisa ANTES de
 * guardar. Es un aviso, no un bloqueo — un salto real de más del 10% existe
 * y quien carga tiene que poder confirmarlo.
 *
 * La referencia es la MEDIANA de las cotizaciones más cercanas, no el
 * promedio: si una vecina ya está mal cargada, no arrastra al resto (mismo
 * criterio que en `lib/economico/rentabilidad.ts`).
 *
 * Funciones puras, con tests.
 */

import { distanciaEnDias } from "../fechas";
import { medianaDe } from "../economico/rentabilidad";

export type Cotizacion = { fecha: string; tc: number };

/** Cuántas vecinas se miran para sacar el valor típico. */
export const VECINAS = 5;

/** Cuánto se puede apartar de las vecinas sin que nadie diga nada. */
export const DESVIO_MAXIMO = 0.1;

export type Desvio = {
  /** El valor típico de los días de alrededor. */
  referencia: number;
  /** Cuántas cotizaciones se usaron para sacarlo. */
  vecinas: number;
  /** Cuánto se aparta, en tanto por uno y con signo: 0.35 es 35% más alto. */
  proporcion: number;
};

/**
 * El tipo de cambio típico alrededor de una fecha, según las cotizaciones ya
 * cargadas. Toma las más cercanas en el tiempo, sean anteriores o
 * posteriores, y devuelve su mediana. Null si no hay ninguna con qué
 * comparar.
 */
export function referenciaCercana(
  cotizaciones: Cotizacion[],
  fecha: string,
  cuantas: number = VECINAS,
): { tc: number; vecinas: number } | null {
  const otras = cotizaciones
    .filter((c) => c.fecha !== fecha && c.tc > 0)
    .sort(
      (a, b) =>
        distanciaEnDias(a.fecha, fecha) - distanciaEnDias(b.fecha, fecha) ||
        a.fecha.localeCompare(b.fecha),
    )
    .slice(0, cuantas);

  const mediana = medianaDe(otras.map((c) => c.tc));
  return mediana === null ? null : { tc: mediana, vecinas: otras.length };
}

/**
 * Mira si una cotización se aparta demasiado de sus vecinas. Devuelve `null`
 * cuando está en línea, o cuando no hay con qué compararla y por lo tanto no
 * hay nada que decir.
 */
export function revisarCotizacion(
  tc: number,
  fecha: string,
  cotizaciones: Cotizacion[],
  maximo: number = DESVIO_MAXIMO,
): Desvio | null {
  const referencia = referenciaCercana(cotizaciones, fecha);
  if (referencia === null) return null;

  const proporcion = (tc - referencia.tc) / referencia.tc;
  if (Math.abs(proporcion) <= maximo) return null;

  return { referencia: referencia.tc, vecinas: referencia.vecinas, proporcion };
}

/** El aviso en palabras, para mostrarle a quien está cargando. */
export function textoDelDesvio(tc: number, desvio: Desvio): string {
  const porcentaje = Math.round(Math.abs(desvio.proporcion) * 100);
  const lado = desvio.proporcion > 0 ? "arriba" : "abajo";
  const numero = (n: number) => n.toLocaleString("es-AR");
  return (
    `${numero(tc)} está un ${porcentaje}% por ${lado} de lo que se viene ` +
    `cargando en esos días (alrededor de ${numero(desvio.referencia)}). ` +
    `Fijate que no falte o sobre un dígito. Si es correcto, guardalo igual.`
  );
}
