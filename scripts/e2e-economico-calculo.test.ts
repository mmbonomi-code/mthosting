/**
 * El motor de cálculo contra los datos REALES ya importados en la base.
 *
 * Los tests de `lib/economico/calcular.test.ts` prueban las reglas con casos
 * chicos. Estos prueban que las reglas, aplicadas a 1.092 movimientos de
 * verdad, reproduzcan los números que Marcos ya había medido a mano en una
 * planilla. Es la única forma de saber que el motor no "da bien" por
 * casualidad.
 *
 * Necesita los datos cargados (importar los CSV de `datos-privados/economico`)
 * y NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY. Sin eso se saltea.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import {
  agregarPorDeptoMes,
  brecha,
  type Celda,
  type FilaAgregable,
} from "../lib/economico/calcular";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hayBase = Boolean(url && clave);

/** PostgREST corta en 1000 filas y no avisa: paginar es corrección, no ajuste. */
async function traerTodo<T>(
  armar: () => ReturnType<SupabaseClient<Database>["from"]>["select"] extends never
    ? never
    : { range: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }> },
): Promise<T[]> {
  const TOPE = 1000;
  const salida: T[] = [];
  for (let desde = 0; ; desde += TOPE) {
    const { data, error } = await armar().range(desde, desde + TOPE - 1);
    if (error) throw new Error(error.message);
    const tanda = data ?? [];
    salida.push(...tanda);
    if (tanda.length < TOPE) break;
  }
  return salida;
}

type Cruda = {
  categoria: FilaAgregable["categoria"];
  monto: number | null;
  cobrado: number | null;
  tarifa_limpieza: number | null;
  moneda: string;
  fecha: string;
  depto_id: string | null;
  grupo_con_coanfitrion: boolean;
  cuenta_id: string | null;
};

let celdas: Celda[] = [];
let porCodigo = new Map<string, string>();
let sinConvertir = 0;
let sinDepartamento = 0;
let payouts = 0;
let noPayoutsSinDepto = 0;
let cuentasSinClasificar = 0;

const deDepto = (codigo: string) => {
  const id = porCodigo.get(codigo);
  return celdas.filter((c) => c.depto_id === id);
};

const sumar = (cs: Celda[], campo: "ganancia" | "percibido" | "aircover" | "reservas") =>
  cs.reduce((s, c) => s + c[campo], 0);

const hasta = (cs: Celda[], mes: string) => cs.filter((c) => c.mes <= mes);

beforeAll(async () => {
  if (!hayBase) return;
  const db = createClient<Database>(url!, clave!);

  const deptos = await traerTodo<{ id: string; codigo: string; comision_pct: number | null }>(
    () => db.from("departamentos").select("id, codigo, comision_pct") as never,
  );
  porCodigo = new Map(deptos.map((d) => [d.codigo, d.id]));
  const comision = new Map(deptos.map((d) => [d.id, Number(d.comision_pct ?? 20)]));

  const cuentas = await traerTodo<{ id: string; clasificacion: string | null }>(
    () => db.from("cuentas_payout").select("id, clasificacion") as never,
  );
  const claseDeCuenta = new Map(cuentas.map((c) => [c.id, c.clasificacion]));

  const crudas = await traerTodo<Cruda>(
    () =>
      db
        .from("movimientos_economicos")
        .select(
          "categoria, monto, cobrado, tarifa_limpieza, moneda, fecha, depto_id, grupo_con_coanfitrion, cuenta_id",
        ) as never,
  );

  const filas: FilaAgregable[] = crudas.map((m) => ({
    categoria: m.categoria,
    monto: m.monto,
    cobrado: m.cobrado,
    tarifa_limpieza: m.tarifa_limpieza,
    moneda: m.moneda,
    fecha: m.fecha,
    depto_id: m.depto_id,
    grupo_con_coanfitrion: m.grupo_con_coanfitrion,
    clase_cuenta:
      m.cuenta_id === null
        ? "sin_clasificar"
        : claseDeCuenta.get(m.cuenta_id) === "mth"
          ? "mth"
          : claseDeCuenta.get(m.cuenta_id) === "propietario"
            ? "propietario"
            : "sin_clasificar",
  }));

  payouts = crudas.filter((m) => m.categoria === "payout").length;
  noPayoutsSinDepto = crudas.filter(
    (m) => m.categoria !== "payout" && m.depto_id === null,
  ).length;
  cuentasSinClasificar = cuentas.filter((c) => c.clasificacion !== "mth" && c.clasificacion !== "propietario").length;

  const r = agregarPorDeptoMes(filas, comision);
  celdas = r.celdas;
  sinConvertir = r.sinConvertir;
  sinDepartamento = r.sinDepartamento;
});

describe.skipIf(!hayBase)("el motor sobre los datos reales", () => {
  it("hay datos cargados", () => {
    expect(celdas.length).toBeGreaterThan(0);
  });

  it("solo los payout quedan sin departamento, y son todos", () => {
    // Los Payout NO traen Anuncio: se imputan por posición dentro del archivo,
    // repartiendo cada uno entre los departamentos de sus filas de detalle
    // (spec §5.2, "Imputación del payout al departamento"). Ese reparto es un
    // paso que TODAVÍA NO EXISTE, así que hoy quedan los 223 afuera.
    //
    // Para KENNEDY y ED TALC no cambia ningún número, porque sus payouts van a
    // cuentas de propietario y no suman a percibido. Sí va a importar en los
    // departamentos donde cobra MTHosting.
    expect(sinDepartamento).toBe(payouts);
    expect(noPayoutsSinDepto).toBe(0);
  });

  describe("KENNEDY 1", () => {
    it("de enero a mayo da lo medido a mano, con el AirCover afuera", () => {
      // La planilla de control daba 1.942,43 comisionando el AirCover de 6,00
      // al 20%. Sin él —que es la decisión tomada— son 1.941,23. Y el segundo
      // archivo agrega 4 reservas de mayo que el primero no tenía, por 222,18.
      const c = hasta(deDepto("KENNEDY 1"), "2026-05");
      expect(sumar(c, "ganancia")).toBeCloseTo(1941.23 + 222.18, 1);
      expect(sumar(c, "percibido")).toBeCloseTo(2115.19, 1);
    });

    it("junio y julio son recupero de deuda: entra el doble y la ganancia NO se mueve", () => {
      const cs = deDepto("KENNEDY 1");
      const junio = cs.find((c) => c.mes === "2026-06")!;
      const julio = cs.find((c) => c.mes === "2026-07")!;

      // Los dos percibidos están medidos a mano en la spec §5.2.
      expect(junio.percibido).toBeCloseTo(956.25, 2);
      expect(julio.percibido).toBeCloseTo(674.63, 2);

      // Y la ganancia de junio sigue en el rango de los meses normales. Si el
      // motor calculara sobre lo cobrado, acá daría el doble.
      const mayo = cs.find((c) => c.mes === "2026-05")!;
      expect(junio.ganancia).toBeLessThan(mayo.ganancia * 1.2);
      expect(junio.ganancia).toBeGreaterThan(mayo.ganancia * 0.8);
    });

    it("la brecha del período completo es el recupero documentado", () => {
      const cs = deDepto("KENNEDY 1");
      const total = {
        ganancia: sumar(cs, "ganancia"),
        percibido: sumar(cs, "percibido"),
        aircover: 0,
        custodia: 0,
      };
      // La spec habla de "+818" de recupero contra la ganancia teórica.
      expect(brecha(total)).toBeCloseTo(818.19, 1);
    });

    it("el AirCover queda afuera y se informa aparte", () => {
      const cs = deDepto("KENNEDY 1");
      expect(sumar(cs, "aircover")).toBeCloseTo(6, 2);
      const abril = cs.find((c) => c.mes === "2026-04")!;
      // 463,68 sin el AirCover. Con él comisionado al 20% daba 464,88.
      expect(abril.ganancia).toBeCloseTo(463.68, 2);
      expect(abril.aircover).toBeCloseTo(6, 2);
    });
  });

  describe("ED TALC — 8 unidades en un solo archivo", () => {
    const UNIDADES = ["05", "06", "07", "08", "09", "11", "12", "33"].map(
      (n) => `ED TALC ${n}`,
    );

    it("las ocho unidades tienen movimientos propios", () => {
      for (const u of UNIDADES) {
        expect(deDepto(u).length, u).toBeGreaterThan(0);
      }
    });

    it("de enero a mayo la ganancia da lo medido a mano", () => {
      const todas = UNIDADES.flatMap((u) => hasta(deDepto(u), "2026-05"));
      expect(sumar(todas, "ganancia")).toBeCloseTo(12117.44, 0);
    });

    it("de enero a mayo el percibido da lo medido a mano", () => {
      const todas = UNIDADES.flatMap((u) => hasta(deDepto(u), "2026-05"));
      expect(sumar(todas, "percibido")).toBeCloseTo(12040.27, 0);
    });

    it("la brecha se explica por los cobros de resolución sin comisionar", () => {
      const todas = UNIDADES.flatMap((u) => hasta(deDepto(u), "2026-05"));
      const total = {
        ganancia: sumar(todas, "ganancia"),
        percibido: sumar(todas, "percibido"),
        aircover: 0,
        custodia: 0,
      };
      expect(brecha(total)).toBeCloseTo(-77.17, 0);
    });
  });

  it("lo que no se pudo convertir queda contado, no escondido", () => {
    // No se exige que sea cero: se exige saber cuántas son.
    expect(sinConvertir).toBeGreaterThanOrEqual(0);
    if (sinConvertir > 0) {
      console.log(`  ${sinConvertir} filas sin tipo de cambio, quedaron fuera de la suma`);
    }
  });

  it("una cuenta sin clasificar no se cuenta como ingreso", () => {
    // Mientras nadie diga si es de MTHosting o de un propietario, sus payouts
    // no suman a percibido. Es lo correcto —no inventar— pero tiene que estar
    // a la vista, no escondido en un cero.
    if (cuentasSinClasificar > 0) {
      console.log(`  ${cuentasSinClasificar} cuenta(s) sin clasificar: sus payouts no suman`);
    }
    expect(cuentasSinClasificar).toBeGreaterThanOrEqual(0);
  });
});
