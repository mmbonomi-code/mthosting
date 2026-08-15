/**
 * Conciliación del módulo económico (spec §6.6).
 *
 * Esta pantalla se construye ANTES que el dashboard, y el motivo está en la
 * spec: nadie va a usar el módulo hasta poder verificar que los números dan
 * bien. Un total lindo que no se puede auditar no sirve.
 *
 * La comprobación central es una identidad del propio archivo de Airbnb: cada
 * Payout es exactamente la suma de las filas que tiene debajo, hasta el
 * próximo Payout. Si eso no cierra, el agrupamiento está mal y todo lo que se
 * calcule encima es dudoso — así que se mide grupo por grupo y se listan los
 * que fallan, en vez de promediar y mirar para otro lado.
 *
 * Funciones puras, con tests.
 */

/** Tolerancia de redondeo: medio centavo. */
const EPSILON = 0.005;

export type FilaDeGrupo = {
  archivo: string;
  linea: number;
  grupo_payout: number | null;
  es_payout: boolean;
  monto: number | null;
  cobrado: number | null;
  moneda: string;
  depto_id: string | null;
};

export type EstadoGrupo =
  /** Payout y detalle en la misma moneda, y la suma da. */
  | "cierra"
  /** Misma moneda y NO da: el agrupamiento está mal. */
  | "no_cierra"
  /** Payout en una moneda y detalle en otra: cierra vía tipo de cambio. */
  | "otra_moneda"
  /** Filas de detalle sin su Payout: el corte del export las dejó sueltas. */
  | "sin_payout"
  /** Payout sin ninguna fila debajo. */
  | "sin_detalle";

export type Grupo = {
  clave: string;
  archivo: string;
  numero: number;
  estado: EstadoGrupo;
  cobrado: number | null;
  monedaPayout: string | null;
  monedaDetalle: string | null;
  sumaDetalle: number;
  /** Solo cuando las dos monedas coinciden. */
  diferencia: number | null;
  /**
   * Cobrado ÷ suma del detalle, cuando las monedas difieren. NO se usa para
   * convertir plata (eso pasa solo si el payout va a una cuenta de MTHosting):
   * se usa para detectar grupos mal armados. Un TC muy fuera de línea con los
   * demás del mismo día delata que al payout le emparejaron filas ajenas.
   */
  tcDeducido: number | null;
  departamentos: number;
  filasDetalle: number;
};

/**
 * Arma los grupos payout → detalle y dice si cada uno cierra.
 *
 * El orden dentro del archivo ES el dato: el importador ya lo resolvió y dejó
 * `grupo_payout`, así que acá solo se junta y se compara.
 */
export function revisarGrupos(filas: FilaDeGrupo[]): Grupo[] {
  const porClave = new Map<string, { payout: FilaDeGrupo | null; detalle: FilaDeGrupo[] }>();

  for (const f of filas) {
    if (f.grupo_payout === null) continue;
    const clave = `${f.archivo}#${f.grupo_payout}`;
    let g = porClave.get(clave);
    if (!g) {
      g = { payout: null, detalle: [] };
      porClave.set(clave, g);
    }
    if (f.es_payout) g.payout = f;
    else g.detalle.push(f);
  }

  const salida: Grupo[] = [];
  for (const [clave, g] of porClave) {
    const [archivo, n] = clave.split("#");
    const sumaDetalle = g.detalle.reduce((s, d) => s + Number(d.monto ?? 0), 0);
    const monedasDetalle = new Set(g.detalle.map((d) => d.moneda));
    const monedaDetalle = monedasDetalle.size === 1 ? [...monedasDetalle][0] : null;
    const departamentos = new Set(g.detalle.map((d) => d.depto_id).filter(Boolean)).size;

    const base = {
      clave,
      archivo,
      numero: Number(n),
      cobrado: g.payout ? Number(g.payout.cobrado ?? 0) : null,
      monedaPayout: g.payout?.moneda ?? null,
      monedaDetalle,
      sumaDetalle,
      departamentos,
      filasDetalle: g.detalle.length,
    };

    if (!g.payout) {
      salida.push({ ...base, estado: "sin_payout", diferencia: null, tcDeducido: null });
      continue;
    }
    if (g.detalle.length === 0) {
      salida.push({ ...base, estado: "sin_detalle", diferencia: null, tcDeducido: null });
      continue;
    }
    if (monedaDetalle !== null && g.payout.moneda !== monedaDetalle) {
      salida.push({
        ...base,
        estado: "otra_moneda",
        diferencia: null,
        tcDeducido: sumaDetalle === 0 ? null : Number(g.payout.cobrado ?? 0) / sumaDetalle,
      });
      continue;
    }
    const diferencia = Number(g.payout.cobrado ?? 0) - sumaDetalle;
    salida.push({
      ...base,
      estado: Math.abs(diferencia) < EPSILON ? "cierra" : "no_cierra",
      diferencia,
      tcDeducido: null,
    });
  }

  return salida.sort(
    (a, b) => a.archivo.localeCompare(b.archivo) || a.numero - b.numero,
  );
}

export type ResumenGrupos = Record<EstadoGrupo, number> & { total: number };

export function contarGrupos(grupos: Grupo[]): ResumenGrupos {
  const r: ResumenGrupos = {
    total: grupos.length,
    cierra: 0,
    no_cierra: 0,
    otra_moneda: 0,
    sin_payout: 0,
    sin_detalle: 0,
  };
  for (const g of grupos) r[g.estado]++;
  return r;
}

/**
 * Tipos de cambio que se salen de la línea de los demás.
 *
 * Se compara contra la MEDIANA y no contra el promedio: un solo grupo roto con
 * un TC de 12.000 arrastra el promedio y después ya no delata a nadie.
 */
export function tcFueraDeLinea(grupos: Grupo[], desvio = 0.2): Grupo[] {
  const conTc = grupos.filter((g) => g.tcDeducido !== null && g.tcDeducido > 0);
  if (conTc.length < 3) return [];
  const orden = conTc.map((g) => g.tcDeducido!).sort((a, b) => a - b);
  const mediana = orden[Math.floor(orden.length / 2)];
  return conTc.filter((g) => Math.abs(g.tcDeducido! - mediana) / mediana > desvio);
}

export type Chequeo = {
  nombre: string;
  ok: boolean;
  detalle: string;
};

/**
 * El semáforo global. Cada chequeo dice qué se miró, no solo si pasó: un
 * "todo bien" sin número no convence a nadie, y con razón.
 */
export function chequeos(entrada: {
  grupos: ResumenGrupos;
  anunciosSinMapear: number;
  cuentasSinClasificar: number;
  filasSinConvertir: number;
  tcRaros: number;
}): Chequeo[] {
  const { grupos, anunciosSinMapear, cuentasSinClasificar, filasSinConvertir, tcRaros } =
    entrada;
  const enMoneda = grupos.total - grupos.otra_moneda - grupos.sin_payout - grupos.sin_detalle;

  return [
    {
      nombre: "Cada payout es la suma de su detalle",
      ok: grupos.no_cierra === 0,
      detalle:
        grupos.no_cierra === 0
          ? `${grupos.cierra} de ${enMoneda} grupos comparables cierran al centavo`
          : `${grupos.no_cierra} grupos no cierran`,
    },
    {
      nombre: "Ningún payout quedó suelto",
      ok: grupos.sin_payout === 0 && grupos.sin_detalle === 0,
      detalle:
        grupos.sin_payout === 0 && grupos.sin_detalle === 0
          ? "todos los grupos tienen payout y detalle"
          : `${grupos.sin_payout} sin payout · ${grupos.sin_detalle} sin detalle`,
    },
    {
      nombre: "Todos los anuncios están mapeados",
      ok: anunciosSinMapear === 0,
      detalle:
        anunciosSinMapear === 0
          ? "ningún anuncio sin departamento"
          : `${anunciosSinMapear} sin departamento`,
    },
    {
      nombre: "Todas las cuentas están clasificadas",
      ok: cuentasSinClasificar === 0,
      detalle:
        cuentasSinClasificar === 0
          ? "ninguna cuenta sin clasificar"
          : `${cuentasSinClasificar} sin clasificar: sus payout no suman a percibido`,
    },
    {
      nombre: "Todas las filas se pudieron sumar",
      ok: filasSinConvertir === 0,
      detalle:
        filasSinConvertir === 0
          ? "ninguna fila quedó afuera por falta de tipo de cambio"
          : `${filasSinConvertir} filas afuera por falta de tipo de cambio`,
    },
    {
      nombre: "Los tipos de cambio deducidos son coherentes",
      ok: tcRaros === 0,
      detalle:
        grupos.otra_moneda === 0
          ? "no hay grupos con payout en otra moneda"
          : tcRaros === 0
            ? `${grupos.otra_moneda} grupos con tipo de cambio deducido, todos en línea`
            : `${tcRaros} de ${grupos.otra_moneda} se salen de la línea: revisar el agrupamiento`,
    },
  ];
}
