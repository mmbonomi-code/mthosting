/**
 * Importación en lote de los CSV de Airbnb (spec §4).
 *
 * El flujo real es exportar ~40 archivos de una sentada, así que el lote es la
 * unidad: se abre uno, se le van pasando los archivos de a uno, y se cierra
 * con un resumen único. Deshacer es deshacer el lote entero.
 *
 * Los archivos se procesan de a uno a propósito. Un lote completo son varios
 * megabytes y miles de filas: mandarlo junto se pasa del límite de una acción
 * de servidor y del tiempo máximo de ejecución. De a uno, además, la pantalla
 * puede mostrar el avance y un archivo roto no se lleva puesto al resto.
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";
import { armarMapa } from "./mapeo";
import {
  ErrorArchivoEconomico,
  parsearTransacciones,
  type CuentaDetectada,
  type FilaTransaccion,
} from "./parser";

type Cliente = SupabaseClient<Database>;
type TipoCarga = Database["public"]["Enums"]["economico_tipo_carga"];
type FilaMovimiento = Database["public"]["Tables"]["movimientos_economicos"]["Insert"];
type FilaProgramado = Database["public"]["Tables"]["cobros_programados"]["Insert"];

export type ResultadoArchivoImportado = {
  nombre: string;
  filas_leidas: number;
  filas_nuevas: number;
  filas_duplicadas: number;
  filas_sin_mapear: number;
  cuentas_nuevas: number;
  avisos: string[];
  error: string | null;
};

export type ResumenLote = {
  import_id: string;
  tipo: TipoCarga;
  archivos: number;
  filas_leidas: number;
  filas_nuevas: number;
  filas_duplicadas: number;
  filas_sin_mapear: number;
  cuentas_sin_clasificar: number;
  anuncios_sin_mapear: number;
  avisos: string[];
};

/** Cuántas filas van por insert. Suficiente para no pasarse de tiempo. */
const TANDA = 500;

// ----------------------------------------------------------------------------

export async function abrirLote(
  supabase: Cliente,
  tipo: TipoCarga,
  usuarioId: string | null,
): Promise<string> {
  const { data, error } = await supabase
    .from("importaciones_economico")
    .insert({ tipo, usuario_id: usuarioId })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo abrir la importación: ${error.message}`);
  return data.id;
}

/**
 * Procesa UN archivo dentro de un lote ya abierto.
 *
 * Nunca lanza por un archivo malo: lo registra con su error y devuelve el
 * resultado, para que el resto del lote siga. Solo lanza si falla la base.
 */
export async function importarArchivo(
  supabase: Cliente,
  importId: string,
  nombre: string,
  contenido: string,
): Promise<ResultadoArchivoImportado> {
  const hash = createHash("sha256").update(contenido).digest("hex");
  const vacio: ResultadoArchivoImportado = {
    nombre,
    filas_leidas: 0,
    filas_nuevas: 0,
    filas_duplicadas: 0,
    filas_sin_mapear: 0,
    cuentas_nuevas: 0,
    avisos: [],
    error: null,
  };

  const { data: lote, error: errorLote } = await supabase
    .from("importaciones_economico")
    .select("tipo")
    .eq("id", importId)
    .single();
  if (errorLote) throw new Error("No se encontró la importación.");

  let leido;
  try {
    leido = parsearTransacciones(contenido);
  } catch (e) {
    const mensaje =
      e instanceof ErrorArchivoEconomico ? e.message : "No se pudo leer el archivo.";
    await registrarArchivo(supabase, importId, nombre, hash, { ...vacio, error: mensaje });
    return { ...vacio, error: mensaje };
  }

  const avisos = [...leido.avisos];

  // El mismo archivo subido dos veces. Se avisa y se procesa igual: la
  // deduplicación por fila lo vuelve inofensivo (agrega 0), y saltearlo
  // taparía el caso de un lote anterior que quedó a medias.
  // Vale también dentro del mismo lote: arrastrar una carpeta que tiene el
  // mismo export dos veces con nombres distintos es el caso más común.
  const { data: yaVisto } = await supabase
    .from("archivos_economico")
    .select("nombre")
    .eq("hash", hash)
    .limit(1);
  if (yaVisto && yaVisto.length > 0) {
    avisos.push(
      `Este archivo ya se había importado antes (como "${yaVisto[0].nombre}"). Se procesa igual; lo que ya estaba no se duplica.`,
    );
  }

  const cuentasNuevas = await asegurarCuentas(supabase, leido.filas);
  const mapa = await armarMapaDeAnuncios(supabase);
  if (mapa.ambiguos.length > 0) {
    avisos.push(
      `Hay anuncios distintos que se escriben casi igual y apuntan a departamentos distintos (${mapa.ambiguos.join(", ")}). Esos se resuelven solo por coincidencia exacta.`,
    );
  }
  const cuentaPorClave = await leerCuentas(supabase);

  const resultado =
    lote.tipo === "programado"
      ? await guardarProgramados(supabase, importId, nombre, leido.filas, mapa.resolver)
      : await guardarEfectivos(
          supabase,
          importId,
          nombre,
          leido.filas,
          mapa.resolver,
          cuentaPorClave,
        );

  const final: ResultadoArchivoImportado = {
    nombre,
    ...resultado,
    cuentas_nuevas: cuentasNuevas,
    avisos,
    error: null,
  };
  await registrarArchivo(supabase, importId, nombre, hash, final);
  return final;
}

/** Cierra el lote y devuelve el resumen único de todo el lote. */
export async function cerrarLote(
  supabase: Cliente,
  importId: string,
): Promise<ResumenLote> {
  const { data: archivos, error } = await supabase
    .from("archivos_economico")
    .select("filas_leidas, filas_nuevas, filas_duplicadas, filas_sin_mapear, error, nombre")
    .eq("import_id", importId);
  if (error) throw new Error("No se pudo leer el detalle del lote.");

  const suma = (campo: "filas_leidas" | "filas_nuevas" | "filas_duplicadas" | "filas_sin_mapear") =>
    (archivos ?? []).reduce((s, a) => s + (a[campo] ?? 0), 0);

  const { data: lote } = await supabase
    .from("importaciones_economico")
    .select("tipo, avisos")
    .eq("id", importId)
    .single();

  // Lo que queda por hacer después de importar: son las dos bandejas.
  const [{ count: sinClasificar }, { data: sinMapear }] = await Promise.all([
    supabase
      .from("cuentas_payout")
      .select("id", { count: "exact", head: true })
      .eq("clasificacion", "sin_clasificar")
      .eq("activo", true),
    supabase
      .from("movimientos_economicos")
      .select("anuncio")
      .eq("activo", true)
      .is("depto_id", null)
      .not("anuncio", "is", null),
  ]);

  const anunciosSinMapear = new Set((sinMapear ?? []).map((m) => m.anuncio)).size;

  const avisos = [
    ...((lote?.avisos as string[] | null) ?? []),
    ...(archivos ?? [])
      .filter((a) => a.error)
      .map((a) => `"${a.nombre}" no se pudo leer: ${a.error}`),
  ];

  const resumen: ResumenLote = {
    import_id: importId,
    tipo: (lote?.tipo ?? "efectivo") as TipoCarga,
    archivos: (archivos ?? []).length,
    filas_leidas: suma("filas_leidas"),
    filas_nuevas: suma("filas_nuevas"),
    filas_duplicadas: suma("filas_duplicadas"),
    filas_sin_mapear: suma("filas_sin_mapear"),
    cuentas_sin_clasificar: sinClasificar ?? 0,
    anuncios_sin_mapear: anunciosSinMapear,
    avisos,
  };

  await supabase
    .from("importaciones_economico")
    .update({
      archivos: resumen.archivos,
      filas_leidas: resumen.filas_leidas,
      filas_nuevas: resumen.filas_nuevas,
      filas_duplicadas: resumen.filas_duplicadas,
      filas_sin_mapear: resumen.filas_sin_mapear,
      cuentas_nuevas: resumen.cuentas_sin_clasificar,
      avisos,
      cerrado_en: new Date().toISOString(),
    })
    .eq("id", importId);

  // El snapshot de programados reemplaza al anterior, no se acumula. Se hace
  // recién al cerrar: hasta que no entraron TODOS los archivos del lote, el
  // snapshot nuevo está incompleto y dar de baja el viejo dejaría un hueco.
  if (resumen.tipo === "programado" && resumen.filas_nuevas > 0) {
    await supabase
      .from("cobros_programados")
      .update({ vigente: false })
      .eq("vigente", true)
      .neq("import_id", importId);
  }

  return resumen;
}

/**
 * Deshace un lote entero. Baja lógica: las filas quedan con `activo = false`
 * y el archivo se puede volver a importar, porque la deduplicación solo mira
 * las filas vivas.
 */
export async function deshacerLote(supabase: Cliente, importId: string): Promise<number> {
  const { data, error } = await supabase
    .from("movimientos_economicos")
    .update({ activo: false })
    .eq("import_id", importId)
    .eq("activo", true)
    .select("id");
  if (error) throw new Error(`No se pudo deshacer: ${error.message}`);

  await supabase
    .from("importaciones_economico")
    .update({ estado: "deshecho" })
    .eq("id", importId);

  return (data ?? []).length;
}

// ----------------------------------------------------------------------------
// Adentro
// ----------------------------------------------------------------------------

async function armarMapaDeAnuncios(supabase: Cliente) {
  const { data, error } = await supabase
    .from("listing_alias")
    .select("nombre_listing, depto_id")
    .eq("canal", "airbnb")
    .eq("activo", true);
  if (error) throw new Error("No se pudo leer el mapa de anuncios.");
  return armarMapa(data ?? []);
}

/**
 * Da de alta las cuentas de destino que todavía no existen.
 *
 * Ninguna se clasifica sola: nacen `sin_clasificar` y quedan en la bandeja
 * hasta que alguien tilde si son de MTHosting o del propietario. Mientras
 * tanto no suman a lo percibido, pero se cuentan a la vista.
 */
async function asegurarCuentas(
  supabase: Cliente,
  filas: FilaTransaccion[],
): Promise<number> {
  const detectadas = new Map<string, CuentaDetectada>();
  for (const f of filas) if (f.cuenta) detectadas.set(f.cuenta.clave, f.cuenta);
  if (detectadas.size === 0) return 0;

  const claves = [...detectadas.keys()];
  const { data: existentes } = await supabase
    .from("cuentas_payout")
    .select("id, clave")
    .in("clave", claves);
  const yaEstan = new Set((existentes ?? []).map((c) => c.clave));

  const nuevas = [...detectadas.values()].filter((c) => !yaEstan.has(c.clave));
  if (nuevas.length > 0) {
    const { error } = await supabase.from("cuentas_payout").insert(
      nuevas.map((c) => ({
        clave: c.clave,
        titular: c.titular,
        numero: c.numero,
        tipo: c.tipo,
        moneda: c.moneda,
      })),
    );
    if (error) throw new Error(`No se pudieron guardar las cuentas: ${error.message}`);
  }

  // Cada grafía encontrada, para poder mostrar de dónde salió cada cuenta.
  const { data: todas } = await supabase
    .from("cuentas_payout")
    .select("id, clave")
    .in("clave", claves);
  const idPorClave = new Map((todas ?? []).map((c) => [c.clave, c.id]));

  const grafias = new Map<string, string>();
  for (const f of filas) {
    if (f.cuenta) grafias.set(f.cuenta.detalle_raw, f.cuenta.clave);
  }
  const { data: aliasExistentes } = await supabase
    .from("cuentas_payout_alias")
    .select("detalle_raw")
    .in("detalle_raw", [...grafias.keys()]);
  const yaAlias = new Set((aliasExistentes ?? []).map((a) => a.detalle_raw));

  const aliasNuevos = [...grafias.entries()]
    .filter(([detalle]) => !yaAlias.has(detalle))
    .map(([detalle, clave]) => ({
      detalle_raw: detalle,
      cuenta_id: idPorClave.get(clave)!,
    }))
    .filter((a) => a.cuenta_id !== undefined);
  if (aliasNuevos.length > 0) {
    await supabase.from("cuentas_payout_alias").insert(aliasNuevos);
  }

  return nuevas.length;
}

async function leerCuentas(supabase: Cliente): Promise<Map<string, string>> {
  const { data } = await supabase.from("cuentas_payout").select("id, clave");
  return new Map((data ?? []).map((c) => [c.clave, c.id]));
}

type Conteo = {
  filas_leidas: number;
  filas_nuevas: number;
  filas_duplicadas: number;
  filas_sin_mapear: number;
};

async function guardarEfectivos(
  supabase: Cliente,
  importId: string,
  archivo: string,
  filas: FilaTransaccion[],
  resolver: (anuncio: string | null) => string | null,
  cuentaPorClave: Map<string, string>,
): Promise<Conteo> {
  const yaEstan = await huellasExistentes(supabase, filas.map((f) => f.huella));
  const nuevas = filas.filter((f) => !yaEstan.has(f.huella));

  const aInsertar: FilaMovimiento[] = nuevas.map((f) => ({
    import_id: importId,
    archivo,
    linea: f.linea,
    orden_en_archivo: f.orden_en_archivo,
    categoria: f.categoria,
    tipo_raw: f.tipo_raw,
    fecha: f.fecha,
    fecha_reserva: f.fecha_reserva,
    fecha_inicio: f.fecha_inicio,
    fecha_fin: f.fecha_fin,
    noches: f.noches,
    depto_id: resolver(f.anuncio),
    anuncio: f.anuncio,
    codigo_confirmacion: f.codigo_confirmacion,
    huesped: f.huesped,
    detalles: f.detalles,
    moneda: f.moneda,
    monto: f.monto,
    cobrado: f.cobrado,
    importe: f.importe,
    tarifa_limpieza: f.tarifa_limpieza,
    ingresos_brutos: f.ingresos_brutos,
    grupo_payout: f.grupo_payout,
    es_payout: f.es_payout,
    cuenta_id: f.cuenta ? (cuentaPorClave.get(f.cuenta.clave) ?? null) : null,
    grupo_con_coanfitrion: f.grupo_con_coanfitrion,
    huella: f.huella,
    ocurrencia: f.ocurrencia,
    raw: f.raw,
  }));

  for (let i = 0; i < aInsertar.length; i += TANDA) {
    const { error } = await supabase
      .from("movimientos_economicos")
      .insert(aInsertar.slice(i, i + TANDA));
    if (error) throw new Error(`No se pudieron guardar los movimientos: ${error.message}`);
  }

  return {
    filas_leidas: filas.length,
    filas_nuevas: aInsertar.length,
    filas_duplicadas: filas.length - aInsertar.length,
    // Las filas sin anuncio (los payouts) no cuentan: se imputan por el grupo.
    filas_sin_mapear: aInsertar.filter((f) => f.anuncio && !f.depto_id).length,
  };
}

/**
 * Los programados son un snapshot: dentro de un lote no se deduplica contra la
 * historia, se guarda lo que dice el archivo. La baja del snapshot anterior la
 * hace `cerrarLote`, cuando ya entraron todos los archivos.
 */
async function guardarProgramados(
  supabase: Cliente,
  importId: string,
  archivo: string,
  filas: FilaTransaccion[],
  resolver: (anuncio: string | null) => string | null,
): Promise<Conteo> {
  const { data: yaEnLote } = await supabase
    .from("cobros_programados")
    .select("huella")
    .eq("import_id", importId);
  const yaEstan = new Set((yaEnLote ?? []).map((f) => f.huella));

  const nuevas = filas.filter((f) => !yaEstan.has(f.huella));

  const aInsertar: FilaProgramado[] = nuevas.map((f) => ({
    import_id: importId,
    archivo,
    linea: f.linea,
    orden_en_archivo: f.orden_en_archivo,
    categoria: f.categoria,
    tipo_raw: f.tipo_raw,
    fecha: f.fecha,
    fecha_reserva: f.fecha_reserva,
    fecha_inicio: f.fecha_inicio,
    fecha_fin: f.fecha_fin,
    noches: f.noches,
    depto_id: resolver(f.anuncio),
    anuncio: f.anuncio,
    codigo_confirmacion: f.codigo_confirmacion,
    huesped: f.huesped,
    detalles: f.detalles,
    moneda: f.moneda,
    monto: f.monto,
    importe: f.importe,
    tarifa_limpieza: f.tarifa_limpieza,
    ingresos_brutos: f.ingresos_brutos,
    huella: f.huella,
    ocurrencia: f.ocurrencia,
    raw: f.raw,
  }));

  for (let i = 0; i < aInsertar.length; i += TANDA) {
    const { error } = await supabase
      .from("cobros_programados")
      .insert(aInsertar.slice(i, i + TANDA));
    if (error) throw new Error(`No se pudieron guardar los programados: ${error.message}`);
  }

  return {
    filas_leidas: filas.length,
    filas_nuevas: aInsertar.length,
    filas_duplicadas: filas.length - aInsertar.length,
    filas_sin_mapear: aInsertar.filter((f) => f.anuncio && !f.depto_id).length,
  };
}

/** Las huellas ya guardadas y vivas, de a tandas para no armar un `in` gigante. */
async function huellasExistentes(
  supabase: Cliente,
  huellas: string[],
): Promise<Set<string>> {
  const encontradas = new Set<string>();
  for (let i = 0; i < huellas.length; i += 200) {
    const { data, error } = await supabase
      .from("movimientos_economicos")
      .select("huella")
      .eq("activo", true)
      .in("huella", huellas.slice(i, i + 200));
    if (error) throw new Error(`No se pudo verificar duplicados: ${error.message}`);
    for (const f of data ?? []) encontradas.add(f.huella);
  }
  return encontradas;
}

async function registrarArchivo(
  supabase: Cliente,
  importId: string,
  nombre: string,
  hash: string,
  resultado: ResultadoArchivoImportado,
): Promise<void> {
  await supabase.from("archivos_economico").insert({
    import_id: importId,
    nombre,
    hash,
    filas_leidas: resultado.filas_leidas,
    filas_nuevas: resultado.filas_nuevas,
    filas_duplicadas: resultado.filas_duplicadas,
    filas_sin_mapear: resultado.filas_sin_mapear,
    error: resultado.error,
  });
}
