/**
 * Traer TODAS las filas de una consulta, y romper fuerte si algo falla.
 *
 * Existe por dos errores que ya se cometieron en este módulo, los dos
 * silenciosos:
 *
 * 1. PostgREST devuelve como máximo 1000 filas y NO avisa. Una pantalla que
 *    hace `.select()` sin paginar muestra los primeros mil movimientos y
 *    parece que anduvo. Ya pasó tres veces en el proyecto.
 *
 * 2. `const { data } = await ...` sin mirar `error` convierte cualquier falla
 *    —una columna mal escrita, un permiso— en `data: null`, que aguas abajo se
 *    lee como "no hay datos". La pantalla queda vacía y perfecta, sin una sola
 *    señal de que la consulta ni siquiera corrió. Así se perdió media tarde
 *    con los próximos cobros: el select pedía una columna inexistente.
 *
 * Por eso acá el error SE LANZA. Un módulo de plata que muestra cero cuando en
 * realidad no pudo leer es peor que uno que muestra un error.
 */

type Consulta<T> = {
  range: (
    desde: number,
    hasta: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

/** Tope de PostgREST. Pedir más de mil no sirve: los recorta igual. */
const TOPE = 1000;

export async function traerTodo<T>(
  armar: () => Consulta<T>,
  queCosa: string,
): Promise<T[]> {
  const salida: T[] = [];
  for (let desde = 0; ; desde += TOPE) {
    const { data, error } = await armar().range(desde, desde + TOPE - 1);
    if (error) {
      throw new Error(`No se pudieron leer ${queCosa}: ${error.message}`);
    }
    const tanda = data ?? [];
    salida.push(...tanda);
    if (tanda.length < TOPE) break;
  }
  return salida;
}
