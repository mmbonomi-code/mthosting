/**
 * Importador de la migración inicial desde Ninox (única vez, Paso 2).
 *
 * Uso:
 *   node scripts/importar-ninox.mjs <deptos.csv> <anuncios.csv> [--aplicar]
 *
 * Sin `--aplicar` hace una simulación: no escribe nada, solo informa qué
 * haría. Los CSV NO se versionan: contienen credenciales de Airbnb.
 *
 * Decisiones tomadas con el dueño (02/08/2026) — ver conversación:
 *   - Se saltean las filas sin datos: "Ed talc 17", "GENERAL", "Jujuy 4A".
 *   - Se importan activos y suspendidos.
 *   - El departamento de cada anuncio sale de la columna NOMBRE.
 *   - Los anuncios con departamento "NO ENVIAR" se saltean.
 *   - "Cómodo depto para tres personas" va a JUJUY 2D.
 *   - Comisión 20% en todos, salvo CABELLO 2 que es 10%.
 *   - No se toma la columna SOCIO.
 *   - Correcciones puntuales de camas en CORRECCIONES_CAMAS.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- Configuración de las decisiones ----------------------------------------

const FILAS_A_SALTEAR = new Set(["Ed talc 17", "GENERAL", "Jujuy 4A"]);

const COMISION_DEFECTO = 20;
const COMISION_POR_DEPTO = { "CABELLO 2": 10 };

/** Correcciones de camas acordadas con el dueño. */
const CORRECCIONES_CAMAS = {
  // 12 sillones cama era un error de tipeo: es una sola cama.
  "MATIENZO 1": { camas_king: 0, camas_queen: 1, camas_twin: 0, sillon_cama: 0 },
  // Para 3 personas: una cama y un sillón cama.
  "SUIPACHA 1": { camas_king: 1, camas_queen: 0, camas_twin: 0, sillon_cama: 1 },
  // Tenía total sin desglose: es una cama king.
  "ED TALC 05": { camas_king: 1, camas_queen: 0, camas_twin: 0, sillon_cama: 0 },
};

/** Anuncios cuyo departamento hay que forzar (colisión de nombre). */
const ANUNCIO_A_DEPTO = { "Cómodo depto para tres personas": "JUJUY 2D" };

/**
 * Propietarios que son la misma persona escrita distinto. La comparación
 * automática (mayúsculas, acentos, espacios) no los junta porque difieren en
 * una letra; se unifican a mano.
 */
const PROPIETARIOS_UNIFICADOS = {
  "angeles hollman": "Angeles Hollmann",
  "maria jose beretta": "Maria José Beretta",
};

/** Columna del CSV → nombre del ítem en el catálogo. */
const EQUIPAMIENTO = {
  "AAC HAB 1": "Aire habitación 1",
  "AAC HAB 2": "Aire habitación 2",
  "AAC HAB 3": "Aire habitación 3",
  "AAC LIVING": "Aire living",
  CALEFACCION: "Calefacción",
  "AGUA CALIENTE": "Agua caliente",
  COCINA: "Cocina",
  HELADERA: "Heladera",
  MICROONDAS: "Microondas",
  PAVA: "Pava",
  CAFETERA: "Cafetera",
  TOSTADORA: "Tostadora",
  SANGUCHERA: "Sanguchera",
  "HORNITO ELECTRICO": "Hornito eléctrico",
  LICUADORA: "Licuadora",
  LAVARROPAS: "Lavarropas",
  TENDER: "Tender",
  PLANCHA: "Plancha",
  "TABLA DE PLANCHAR": "Tabla de planchar",
  Aspiradora: "Aspiradora",
  TV: "TV",
  "TIENE BALCON": "Balcón",
  PERCHAS: "Perchas",
  BASURA: "Basura",
  "SECADOR DE PELO": "Secador de pelo",
  FRAZADA: "Frazadas",
  PILETA: "Pileta",
  GYM: "Gimnasio",
  SAUNA: "Sauna",
  LAUNDRY: "Laundry",
  ESTACIONAMIENTO: "Estacionamiento",
};

const AMBIENTES = {
  MONOAMBIENTE: "monoambiente",
  "2 AMBIENTES": "dos",
  "3 AMBIENTES": "tres",
  "4 AMBIENTES": "cuatro",
};

const ACUERDOS = {
  "COBRA CADA UNO SU PARTE": "cobra_cada_uno",
  "COBRA TODO MTH": "cobra_todo_mth",
  "MTH COBRA UNICAMENTE COMISION": "solo_comision",
};

// --- Utilidades --------------------------------------------------------------

function parseCSV(texto) {
  const filas = [];
  let campo = "", fila = [], enComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (enComillas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++; } else enComillas = false;
      } else campo += c;
    } else if (c === '"') enComillas = true;
    else if (c === ",") { fila.push(campo); campo = ""; }
    else if (c === "\n") { fila.push(campo); filas.push(fila); fila = []; campo = ""; }
    else if (c !== "\r") campo += c;
  }
  if (campo !== "" || fila.length > 0) { fila.push(campo); filas.push(fila); }
  return filas;
}

function leerCSV(ruta) {
  const filas = parseCSV(readFileSync(ruta, "utf8"));
  const enc = filas[0].map((h) => h.trim());
  return filas
    .slice(1)
    .filter((f) => f.some((v) => v.trim() !== ""))
    .map((f) => Object.fromEntries(enc.map((h, i) => [h, (f[i] ?? "").trim()])));
}

/**
 * Repara texto UTF-8 que quedo leido como Windows-1252 ("corazA3n" -> "corazon").
 * No alcanza con Latin-1: los bytes 0x80-0x9F se ven como comillas y simbolos
 * raros (por ejemplo 0x9A es \u0161), y hay que mapearlos de vuelta a su byte.
 */
const CP1252_INVERSO = new Map(
  Object.entries({
    "\u20AC": 0x80, "\u201A": 0x82, "\u0192": 0x83, "\u201E": 0x84,
    "\u2026": 0x85, "\u2020": 0x86, "\u2021": 0x87, "\u02C6": 0x88,
    "\u2030": 0x89, "\u0160": 0x8a, "\u2039": 0x8b, "\u0152": 0x8c,
    "\u017D": 0x8e, "\u2018": 0x91, "\u2019": 0x92, "\u201C": 0x93,
    "\u201D": 0x94, "\u2022": 0x95, "\u2013": 0x96, "\u2014": 0x97,
    "\u02DC": 0x98, "\u2122": 0x99, "\u0161": 0x9a, "\u203A": 0x9b,
    "\u0153": 0x9c, "\u017E": 0x9e, "\u0178": 0x9f,
  }),
);

function repararCodificacion(texto) {
  if (!/[\u00C3\u00C2]/.test(texto)) return texto;
  const bytes = [];
  for (const caracter of texto) {
    const codigo = CP1252_INVERSO.get(caracter) ?? caracter.codePointAt(0);
    if (codigo > 0xff) return texto; // no venia de cp1252: se deja como esta
    bytes.push(codigo);
  }
  const reparado = Buffer.from(bytes).toString("utf8");
  // Si la reparacion deja caracteres de reemplazo, el texto no estaba roto.
  return reparado.includes("\uFFFD") ? texto : reparado;
}

const vacio = (v) => !v || v.trim() === "";
const nulo = (v) => (vacio(v) ? null : v.trim());
const entero = (v) => (vacio(v) ? null : Number.parseInt(v, 10) || 0);

/** Nombre normalizado, para detectar propietarios repetidos por escritura. */
const normalizar = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// --- Mapeos ------------------------------------------------------------------

/** Equipamiento: "Yes"/"No"/texto libre → { tiene, detalle } o null si se saltea. */
function mapearEquipamiento(valor) {
  const v = (valor ?? "").trim();
  if (v === "") return null;

  const limpio = v.toLowerCase().replace(/[.\s]+$/, "");

  if (/^(yes|si|sí|s)$/.test(limpio)) return { tiene: true, detalle: null };
  if (/^(no|no tiene|0|-)$/.test(limpio)) return { tiene: false, detalle: null };
  // Dudas del que cargó, no datos: no se marcan.
  if (/^(nose|no se|ver|\?)$/.test(limpio)) return null;
  // "No, en la esquina hay un lavadero" → no tiene, pero el texto se conserva.
  if (/^no[,;]/.test(limpio)) return { tiene: false, detalle: v };

  return { tiene: true, detalle: v };
}

/** Baño: texto de Ninox → { tipo, detalle } o null si ese baño no existe. */
function mapearBano(valor) {
  const v = (valor ?? "").trim();
  if (v === "") return null;

  const u = v.toUpperCase();
  if (/^(NO TIENE|NO|0|1)$/.test(u)) return null;

  if (u.includes("TOILET")) return { tipo: "toilette", detalle: null };
  // "SIN BAÑADERA" tiene que evaluarse antes que "BAÑADERA".
  if (u.includes("SIN BAÑADERA")) return { tipo: "completo_ducha", detalle: null };
  if (u.includes("BAÑADERA")) return { tipo: "completo_banera", detalle: null };
  if (u.includes("DUCHA")) return { tipo: "completo_ducha", detalle: null };

  // Ambiguos ("COMPLETO", "SIN BIDET"): se asume ducha y se conserva el texto
  // para revisarlo a mano.
  return { tipo: "completo_ducha", detalle: v, revisar: true };
}

/** CHECK OUT de Ninox → self_checkout. */
function mapearSelfCheckout(valor) {
  const v = (valor ?? "").trim().toUpperCase();
  if (v === "") return "no";

  if (v.includes("BAJA, ABRE PUERTA")) return "solo_multiples";
  if (v.includes("SIN SELF") || v.includes("PRESENCIAL")) return "no";
  if (
    v.includes("SELF") ||
    v.includes("CAJITA") ||
    v.includes("CAJA") ||
    v.includes("CODIGO") ||
    v.includes("SEGURIDAD") ||
    v.includes("DEJA LLAVES") ||
    v.includes("SOLO SE VAN")
  ) {
    return "siempre";
  }
  return "no";
}

// --- Programa ----------------------------------------------------------------

const [rutaDeptos, rutaAnuncios] = process.argv.slice(2);
const aplicar = process.argv.includes("--aplicar");

if (!rutaDeptos || !rutaAnuncios) {
  console.error("Uso: node scripts/importar-ninox.mjs <deptos.csv> <anuncios.csv> [--aplicar]");
  process.exit(1);
}

const filasDeptos = leerCSV(rutaDeptos).filter((d) => !FILAS_A_SALTEAR.has(d.NOMBRE.trim()));
const filasAnuncios = leerCSV(rutaAnuncios);

const avisos = [];

// 1) Propietarios, unificando los que difieren solo en la escritura.
const propietarios = new Map(); // clave normalizada → datos
for (const d of filasDeptos) {
  const original = d.PROPIETARIO.trim();
  if (!original) continue;
  const nombre = PROPIETARIOS_UNIFICADOS[normalizar(original)] ?? original;
  const clave = normalizar(nombre);
  const previo = propietarios.get(clave);
  if (previo) {
    // Se conserva la escritura más larga (suele ser la completa: con acento
    // o con el apellido entero) y se completan los datos que falten.
    if (nombre.length > previo.nombre.length) previo.nombre = nombre;
    previo.contacto ??= nulo(d.TELEFONO);
    previo.fecha_nacimiento ??= nulo(d["FECHA DE NACIMIENTO"]);
    previo.cuenta_cobro ??= nulo(d["CUENTA DE COBRO"]);
    previo.deptos.push(d.NOMBRE.trim());
  } else {
    propietarios.set(clave, {
      nombre,
      contacto: nulo(d.TELEFONO),
      fecha_nacimiento: nulo(d["FECHA DE NACIMIENTO"]),
      cuenta_cobro: nulo(d["CUENTA DE COBRO"]),
      datos_bancarios: nulo(d["DATOS BANCARIOS"]),
      deptos: [d.NOMBRE.trim()],
    });
  }
}

for (const p of propietarios.values()) {
  if (p.fecha_nacimiento) {
    // Ninox exporta dd/mm/aaaa; la base espera aaaa-mm-dd.
    const m = p.fecha_nacimiento.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    p.fecha_nacimiento = m ? `${m[3]}-${m[2]}-${m[1]}` : null;
  }
}

// 2) Departamentos.
const departamentos = [];
const banosPorDepto = new Map();
const equipamientoPorDepto = new Map();

for (const d of filasDeptos) {
  const codigo = d.NOMBRE.trim();

  const camas = CORRECCIONES_CAMAS[codigo] ?? {
    camas_king: entero(d.KING) ?? 0,
    camas_queen: entero(d.QUEEN) ?? 0,
    camas_twin: entero(d.TWIN) ?? 0,
    sillon_cama: entero(d["SILLON CAMA"]) ?? 0,
  };

  const totalNinox = entero(d["TOTAL DE CAMAS"]);
  const sumaCargada = camas.camas_king + camas.camas_queen + camas.camas_twin + camas.sillon_cama;
  if (!CORRECCIONES_CAMAS[codigo] && totalNinox && totalNinox !== sumaCargada) {
    avisos.push(`camas: ${codigo} — Ninox dice ${totalNinox}, las cantidades suman ${sumaCargada}`);
  }

  // La columna "Otro" son amenities sueltos: van a la observación.
  const observacion = [nulo(d.OBSERVACION), d.Otro ? `Otro: ${d.Otro}` : null]
    .filter(Boolean)
    .join("\n") || null;

  departamentos.push({
    codigo,
    nombre_interno: codigo,
    estado: d.ESTADO === "SUSPENDIDO" ? "suspendido" : "activo",
    activo: true,
    direccion: nulo(d.DIRECCION),
    ambientes: AMBIENTES[d.AMBIENTES] ?? null,
    habitaciones: entero(d.HABITACIONES),
    ...camas,
    comision_pct: COMISION_POR_DEPTO[codigo] ?? COMISION_DEFECTO,
    acuerdo_pago: ACUERDOS[d["ACUERDO DE PAGO"]] ?? null,
    wifi_ssid: nulo(d["RED WIFI"]),
    wifi_pass: nulo(d["CLAVE WIFI"]),
    wifi_velocidad: nulo(d["velocidad wifi"]),
    airbnb_user: nulo(d["USUARIO AIRBNB"]),
    airbnb_pass: nulo(d["CLAVE AIRBNB"]),
    url_publicacion: nulo(d.PUBLICACION),
    url_mapa: nulo(d.Mapa),
    encargado_nombre: nulo(d["Encargado Nombre y Telefono"]),
    propietario_telefono: nulo(d.TELEFONO),
    self_checkout: mapearSelfCheckout(d["CHECK OUT"]),
    trabajo_verificado: d["TRABAJO VERIFICADO"] === "Sí",
    observacion,
    _propietario: d.PROPIETARIO.trim()
      ? normalizar(
          PROPIETARIOS_UNIFICADOS[normalizar(d.PROPIETARIO)] ?? d.PROPIETARIO,
        )
      : null,
  });

  // Baños
  const banos = [];
  for (const [indice, col] of ["BAÑO 1", "BAÑO 2", "BAÑO 3"].entries()) {
    const bano = mapearBano(d[col]);
    if (!bano) continue;
    if (bano.revisar) avisos.push(`baño ambiguo: ${codigo} ${col} = "${d[col]}" → se asumió ducha`);
    banos.push({ tipo: bano.tipo, detalle: bano.detalle, orden: indice + 1 });
  }
  banosPorDepto.set(codigo, banos);

  // Equipamiento
  const equipamiento = [];
  for (const [col, item] of Object.entries(EQUIPAMIENTO)) {
    const mapeado = mapearEquipamiento(d[col]);
    if (mapeado) equipamiento.push({ item, ...mapeado });
  }
  equipamientoPorDepto.set(codigo, equipamiento);
}

const codigosValidos = new Set(departamentos.map((d) => d.codigo));

// 3) Anuncios.
const aliases = [];
const vistos = new Map();
let salteadosNoEnviar = 0;

for (const a of filasAnuncios) {
  if (a.Departamento.trim() === "NO ENVIAR") { salteadosNoEnviar++; continue; }

  const nombre = repararCodificacion(a.Anuncio.trim());
  if (!nombre) continue;

  const depto = ANUNCIO_A_DEPTO[nombre] ?? a.NOMBRE.trim();

  if (!codigosValidos.has(depto)) {
    avisos.push(`anuncio sin departamento: "${nombre}" → "${depto}" no existe`);
    continue;
  }

  const previo = vistos.get(nombre);
  if (previo) {
    if (previo !== depto) {
      avisos.push(`anuncio duplicado con departamentos distintos: "${nombre}" (${previo} vs ${depto})`);
    }
    continue;
  }
  vistos.set(nombre, depto);
  aliases.push({ nombre_listing: nombre, canal: "airbnb", _depto: depto });
}

// --- Informe -----------------------------------------------------------------

console.log("=== RESUMEN ===");
console.log(`propietarios:   ${propietarios.size}`);
console.log(`departamentos:  ${departamentos.length} (${departamentos.filter((d) => d.estado === "activo").length} activos, ${departamentos.filter((d) => d.estado === "suspendido").length} suspendidos)`);
console.log(`baños:          ${[...banosPorDepto.values()].reduce((s, b) => s + b.length, 0)}`);
console.log(`equipamiento:   ${[...equipamientoPorDepto.values()].reduce((s, e) => s + e.length, 0)} filas`);
console.log(`anuncios:       ${aliases.length} (${salteadosNoEnviar} salteados por "NO ENVIAR")`);

const unificados = [...propietarios.values()].filter((p) => p.deptos.length > 1);
console.log(`\npropietarios con más de un departamento: ${unificados.length}`);

if (avisos.length > 0) {
  console.log(`\n=== AVISOS (${avisos.length}) ===`);
  avisos.forEach((a) => console.log("  • " + a));
}

if (!aplicar) {
  console.log("\n(simulación: no se escribió nada. Agregá --aplicar para importar)");
  process.exit(0);
}

// --- Escritura ---------------------------------------------------------------

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !clave) {
  console.error("\nFaltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en el entorno.");
  process.exit(1);
}

const supabase = createClient(url, clave, { auth: { persistSession: false } });

console.log("\n=== IMPORTANDO ===");

// Propietarios
const idPropietario = new Map();
for (const [clave_, p] of propietarios) {
  const { data, error } = await supabase
    .from("propietarios")
    .insert({
      nombre: p.nombre,
      contacto: p.contacto,
      fecha_nacimiento: p.fecha_nacimiento,
      cuenta_cobro: p.cuenta_cobro,
      datos_bancarios: p.datos_bancarios,
    })
    .select("id")
    .single();
  if (error) { console.error(`  propietario "${p.nombre}":`, error.message); continue; }
  idPropietario.set(clave_, data.id);
}
console.log(`propietarios importados: ${idPropietario.size}`);

// Departamentos
const idDepto = new Map();
for (const d of departamentos) {
  const { _propietario, ...datos } = d;
  const { data, error } = await supabase
    .from("departamentos")
    .insert({ ...datos, propietario_id: _propietario ? idPropietario.get(_propietario) ?? null : null })
    .select("id")
    .single();
  if (error) { console.error(`  departamento "${d.codigo}":`, error.message); continue; }
  idDepto.set(d.codigo, data.id);
}
console.log(`departamentos importados: ${idDepto.size}`);

// Baños
const filasBanos = [];
for (const [codigo, banos] of banosPorDepto) {
  const deptoId = idDepto.get(codigo);
  if (!deptoId) continue;
  banos.forEach((b) => filasBanos.push({ depto_id: deptoId, ...b }));
}
if (filasBanos.length) {
  const { error } = await supabase.from("banos_depto").insert(filasBanos);
  if (error) console.error("  baños:", error.message);
}
console.log(`baños importados: ${filasBanos.length}`);

// Equipamiento
const { data: catalogo } = await supabase.from("item_catalogo").select("id, nombre");
const idItem = new Map((catalogo ?? []).map((i) => [i.nombre, i.id]));

const filasEquip = [];
for (const [codigo, items] of equipamientoPorDepto) {
  const deptoId = idDepto.get(codigo);
  if (!deptoId) continue;
  for (const it of items) {
    const itemId = idItem.get(it.item);
    if (!itemId) { console.error(`  ítem no encontrado en el catálogo: "${it.item}"`); continue; }
    filasEquip.push({ depto_id: deptoId, item_id: itemId, tiene: it.tiene, detalle: it.detalle });
  }
}
for (let i = 0; i < filasEquip.length; i += 500) {
  const { error } = await supabase.from("inventario_depto").insert(filasEquip.slice(i, i + 500));
  if (error) console.error("  equipamiento:", error.message);
}
console.log(`equipamiento importado: ${filasEquip.length}`);

// Anuncios
const filasAlias = aliases
  .map((a) => ({
    depto_id: idDepto.get(a._depto),
    canal: a.canal,
    nombre_listing: a.nombre_listing,
  }))
  .filter((a) => a.depto_id);
if (filasAlias.length) {
  const { error } = await supabase.from("listing_alias").insert(filasAlias);
  if (error) console.error("  anuncios:", error.message);
}
console.log(`anuncios importados: ${filasAlias.length}`);

console.log("\nListo.");
