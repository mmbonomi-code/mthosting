/**
 * Importador económico contra los CSV reales y la base DEV.
 *
 * Los archivos viven en `datos-privados/` y NO están en el repositorio: traen
 * nombre y apellido de huéspedes. Sin esa carpeta, estos tests se saltean.
 *
 * Los números esperados salen del punto 11 de la especificación. No son
 * inventados: se midieron sobre estos mismos archivos antes de escribirla.
 * Si algo de acá no cierra, el error es del código.
 */
import { afterEach, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { parsearTransacciones, type FilaTransaccion } from "../lib/economico/parser";
import {
  abrirLote,
  cerrarLote,
  deshacerLote,
  importarArchivo,
} from "../lib/economico/importar";

const DIR = "datos-privados/economico";
const KENNEDY_ANT = `${DIR}/airbnb_01_2026-05_2026 (ANT).csv`;
const KENNEDY_ULT = `${DIR}/airbnb_01_2026-07_2026 (ULT).csv`;
const ED_TALC = `${DIR}/airbnb_01_2026-05_2026 (28).csv`;

const hayArchivos = existsSync(KENNEDY_ANT) && existsSync(ED_TALC);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

const leer = (ruta: string) => parsearTransacciones(readFileSync(ruta, "utf8"));

function porGrupo(filas: FilaTransaccion[]): Map<number, FilaTransaccion[]> {
  const grupos = new Map<number, FilaTransaccion[]>();
  for (const f of filas) {
    if (f.grupo_payout === null) continue;
    const g = grupos.get(f.grupo_payout) ?? [];
    g.push(f);
    grupos.set(f.grupo_payout, g);
  }
  return grupos;
}

describe.skipIf(!hayArchivos)("parser sobre los archivos reales", () => {
  it("ED TALC: 870 filas, 8 departamentos en un solo archivo", () => {
    // La exportación se hace POR PROPIETARIO: nunca "un archivo = un depto".
    const { filas } = leer(ED_TALC);
    expect(filas).toHaveLength(870);
    const anuncios = new Set(filas.map((f) => f.anuncio).filter(Boolean));
    expect(anuncios.size).toBe(8);
  });

  it("ED TALC: 147 grupos de payout, ninguno huérfano", () => {
    const { filas } = leer(ED_TALC);
    expect(porGrupo(filas).size).toBe(147);
    expect(filas.filter((f) => f.grupo_payout === null)).toHaveLength(0);
  });

  it("ED TALC: el payout es exactamente la suma de su detalle, en los 147", () => {
    // Es la identidad que sostiene el reparto entre departamentos: si cierra,
    // la parte de cada depto es la suma de sus filas y no hay que prorratear.
    const { filas } = leer(ED_TALC);
    let cierran = 0;
    let totalPayouts = 0;
    for (const [, grupo] of porGrupo(filas)) {
      const payout = grupo.find((f) => f.es_payout)!;
      const detalle = grupo.filter((f) => !f.es_payout);
      const suma = detalle.reduce((s, f) => s + (f.monto ?? 0), 0);
      totalPayouts += payout.importe ?? 0;
      if (Math.abs(suma - (payout.importe ?? 0)) < 0.005) cierran++;
    }
    expect(cierran).toBe(147);
    expect(totalPayouts).toBeCloseTo(25_119.88, 2);
  });

  it("ED TALC: 100 grupos reparten entre más de un departamento", () => {
    const { filas } = leer(ED_TALC);
    let multi = 0;
    for (const [, grupo] of porGrupo(filas)) {
      const anuncios = new Set(
        grupo.filter((f) => !f.es_payout).map((f) => f.anuncio).filter(Boolean),
      );
      if (anuncios.size > 1) multi++;
    }
    expect(multi).toBe(100);
  });

  it("ED TALC: los 6 AirCover quedan aparte, no como ingreso del alquiler", () => {
    const { filas } = leer(ED_TALC);
    const aircover = filas.filter((f) => f.categoria === "aircover");
    expect(aircover).toHaveLength(6);
    expect(aircover.reduce((s, f) => s + (f.monto ?? 0), 0)).toBeCloseTo(168, 2);
  });

  it("KENNEDY 1: 152 filas, y las de coanfitrión conservan su signo", () => {
    const { filas } = leer(KENNEDY_ANT);
    expect(filas).toHaveLength(152);
    const coanfitrion = filas.filter((f) => f.categoria === "coanfitrion");
    expect(coanfitrion).toHaveLength(46);
    // Existen líneas POSITIVAS: son devoluciones de comisión al ajustar una
    // reserva. Con valor absoluto sumarían en vez de restar.
    expect(coanfitrion.some((f) => (f.monto ?? 0) > 0)).toBe(true);
  });

  it("KENNEDY 1: el payout viene en pesos y el detalle en dólares", () => {
    const { filas } = leer(KENNEDY_ANT);
    expect(filas.filter((f) => f.es_payout).every((f) => f.moneda === "ARS")).toBe(true);
    expect(filas.filter((f) => !f.es_payout).every((f) => f.moneda === "USD")).toBe(true);
    // El tipo de cambio se despeja del propio grupo, sin fuente externa.
    const grupo = [...porGrupo(filas).values()].find(
      (g) => g.some((f) => f.es_payout) && g.length > 1,
    )!;
    const payout = grupo.find((f) => f.es_payout)!;
    const detalle = grupo
      .filter((f) => !f.es_payout)
      .reduce((s, f) => s + (f.monto ?? 0), 0);
    expect((payout.importe ?? 0) / detalle).toBeGreaterThan(1000);
  });

  it("ninguna huella se repite dentro de un archivo", () => {
    for (const ruta of [KENNEDY_ANT, KENNEDY_ULT, ED_TALC]) {
      const { filas } = leer(ruta);
      expect(new Set(filas.map((f) => f.huella)).size).toBe(filas.length);
    }
  });

  it("las tres exportaciones se reconocen como cobros efectivos", () => {
    for (const ruta of [KENNEDY_ANT, KENNEDY_ULT, ED_TALC]) {
      expect(leer(ruta).pareceProgramado).toBe(false);
    }
  });
});

describe.skipIf(!hayArchivos || !url || !clave)("importador (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const lotes: string[] = [];

  async function nuevoLote(): Promise<string> {
    const id = await abrirLote(s, "efectivo", null);
    lotes.push(id);
    return id;
  }

  const importar = (loteId: string, ruta: string) =>
    importarArchivo(s, loteId, ruta.split("/").pop()!, readFileSync(ruta, "utf8"));

  // Se limpia después de CADA test, no al final: la deduplicación es global
  // a propósito (una fila ya cargada no se vuelve a tomar, venga del lote que
  // venga), así que un test que deja datos hace que el siguiente importe cero.
  // La base de desarrollo queda como estaba: esto es prueba, no la carga real.
  afterEach(async () => {
    for (const id of lotes.splice(0)) {
      await s.from("movimientos_economicos").delete().eq("import_id", id);
      await s.from("archivos_economico").delete().eq("import_id", id);
      await s.from("importaciones_economico").delete().eq("id", id);
    }
  });

  it("importa, detecta los duplicados y reimportar no agrega nada", async () => {
    const lote = await nuevoLote();

    // ANT entero es nuevo.
    const ant = await importar(lote, KENNEDY_ANT);
    expect(ant.error).toBeNull();
    expect(ant.filas_leidas).toBe(152);
    expect(ant.filas_nuevas).toBe(152);
    expect(ant.filas_duplicadas).toBe(0);

    // ULT contiene a ANT y lo extiende: solo entran las 70 que faltaban.
    const ult = await importar(lote, KENNEDY_ULT);
    expect(ult.filas_leidas).toBe(222);
    expect(ult.filas_nuevas).toBe(70);
    expect(ult.filas_duplicadas).toBe(152);

    // Y volver a subir el mismo archivo no agrega ni una fila.
    const otraVez = await importar(lote, KENNEDY_ULT);
    expect(otraVez.filas_nuevas).toBe(0);
    expect(otraVez.filas_duplicadas).toBe(222);
    expect(otraVez.avisos.some((a) => a.includes("ya se había importado"))).toBe(true);

    const { count } = await s
      .from("movimientos_economicos")
      .select("id", { count: "exact", head: true })
      .eq("import_id", lote)
      .eq("activo", true);
    expect(count).toBe(222);
  });

  it("da igual el orden en que entren los archivos", async () => {
    // Criterio de aceptación 1: importar en cualquier orden da lo mismo.
    const alReves = await nuevoLote();
    const ult = await importar(alReves, KENNEDY_ULT);
    const ant = await importar(alReves, KENNEDY_ANT);
    expect(ult.filas_nuevas).toBe(222);
    expect(ant.filas_nuevas).toBe(0);

    const { count } = await s
      .from("movimientos_economicos")
      .select("id", { count: "exact", head: true })
      .eq("import_id", alReves)
      .eq("activo", true);
    expect(count).toBe(222);
  });

  it("imputa cada fila a su departamento y no descarta ninguna", async () => {
    const lote = await nuevoLote();
    const r = await importar(lote, ED_TALC);
    expect(r.filas_nuevas).toBe(870);
    // Los 8 anuncios de ED TALC ya están mapeados en la app.
    expect(r.filas_sin_mapear).toBe(0);

    const { data } = await s
      .from("movimientos_economicos")
      .select("depto_id, es_payout, anuncio")
      .eq("import_id", lote)
      .eq("activo", true);

    // Un archivo, ocho departamentos: la imputación es fila por fila.
    const deptos = new Set((data ?? []).map((m) => m.depto_id).filter(Boolean));
    expect(deptos.size).toBe(8);

    // Los payouts no traen anuncio: se imputan por su grupo, no por el texto.
    const payouts = (data ?? []).filter((m) => m.es_payout);
    expect(payouts).toHaveLength(147);
    expect(payouts.every((m) => m.anuncio === null)).toBe(true);
  });

  it("da de alta las cuentas que encuentra y no las clasifica sola", async () => {
    const lote = await nuevoLote();
    await importar(lote, KENNEDY_ANT);

    const { data } = await s
      .from("cuentas_payout")
      .select("clave, titular, numero, moneda, clasificacion")
      .eq("clave", "num:0665")
      .single();
    expect(data!.titular).toBe("Emmanuel De Saizieu");
    expect(data!.numero).toBe("0665");
    expect(data!.moneda).toBe("ARS");
    // Ninguna cuenta se clasifica automáticamente: la tilda una persona.
    expect(data!.clasificacion).toBe("sin_clasificar");
  });

  it("el resumen del lote suma todos los archivos, no uno por uno", async () => {
    const lote = await nuevoLote();
    await importar(lote, KENNEDY_ANT);
    await importar(lote, ED_TALC);

    const resumen = await cerrarLote(s, lote);
    expect(resumen.archivos).toBe(2);
    expect(resumen.filas_leidas).toBe(152 + 870);
    expect(resumen.filas_nuevas).toBe(152 + 870);
  });

  it("deshacer el lote lo saca de la vista y permite volver a importarlo", async () => {
    const lote = await nuevoLote();
    await importar(lote, KENNEDY_ANT);
    const deshechas = await deshacerLote(s, lote);
    expect(deshechas).toBe(152);

    // Nada se borra: las filas siguen ahí, apagadas.
    const { count: apagadas } = await s
      .from("movimientos_economicos")
      .select("id", { count: "exact", head: true })
      .eq("import_id", lote)
      .eq("activo", false);
    expect(apagadas).toBe(152);

    // Y el archivo se puede volver a subir, que es para lo que se deshace.
    const otro = await nuevoLote();
    const r = await importar(otro, KENNEDY_ANT);
    expect(r.filas_nuevas).toBe(152);
  });
});
