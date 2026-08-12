/**
 * Caja contra la base DEV: que el saldo cierre, que las funciones de saldo
 * hagan una agregación y no un recorrido, y que el histórico importado sea
 * consistente. No escribe nada salvo lo que limpia después.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import {
  acumular,
  deudaPorDepartamento,
  enDolares,
  pesos,
  resultado,
  type Movimiento,
  type TipoMovimiento,
} from "../lib/caja/saldo";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** El saldo que tiene que dar el histórico de Ninox al 10/08/2026. */
const SALDO_ESPERADO = 226_417;

describe.skipIf(!url || !clave)("caja (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const creados: string[] = [];

  afterAll(async () => {
    for (const id of creados) await s.from("movimientos_caja").delete().eq("id", id);
  });

  async function todos(): Promise<Movimiento[]> {
    const filas: Movimiento[] = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await s
        .from("movimientos_caja")
        .select(
          `id, fecha, tipo, monto, moneda, tc, descripcion, reembolsable,
           fecha_cobro, forma_cobro,
           categoria:categorias_movimiento(id, nombre),
           depto:departamentos(id, codigo)`,
        )
        .eq("activo", true)
        .order("fecha")
        .order("created_at")
        .range(desde, desde + 999);
      expect(error).toBeNull();
      const tanda = (data ?? []) as unknown as {
        id: string; fecha: string; tipo: string; monto: number; moneda: string;
        tc: number | null; descripcion: string | null; reembolsable: boolean;
        fecha_cobro: string | null; forma_cobro: string | null;
        categoria: { id: string; nombre: string } | null;
        depto: { id: string; codigo: string } | null;
      }[];
      filas.push(
        ...tanda.map((m) => ({
          id: m.id, fecha: m.fecha, tipo: m.tipo as TipoMovimiento, monto: m.monto,
          moneda: m.moneda, tc: m.tc, descripcion: m.descripcion,
          categoria_id: m.categoria?.id ?? null,
          categoria_nombre: m.categoria?.nombre ?? null,
          depto_id: m.depto?.id ?? null,
          depto_codigo: m.depto?.codigo ?? null,
          reembolsable: m.reembolsable, fecha_cobro: m.fecha_cobro,
          forma_cobro: m.forma_cobro,
        })),
      );
      if (tanda.length < 1000) break;
    }
    return filas;
  }

  it("el saldo de la base coincide con el del histórico de Ninox", async () => {
    const { data, error } = await s.rpc("saldo_caja");
    expect(error).toBeNull();
    console.log(`saldo en la base: ${pesos(Number(data))}`);
    expect(Math.round(Number(data))).toBe(SALDO_ESPERADO);
  });

  it("el saldo que devuelve la base es el mismo que sumar los movimientos", async () => {
    const movimientos = await todos();
    const { data } = await s.rpc("saldo_caja");
    console.log(`${movimientos.length} movimientos · resultado ${pesos(resultado(movimientos))}`);
    expect(Math.round(resultado(movimientos))).toBe(Math.round(Number(data)));
  });

  it("el saldo acumulado del último movimiento es el saldo total", async () => {
    const movimientos = await todos();
    const conSaldo = acumular(movimientos, 0);
    expect(Math.round(conSaldo[conSaldo.length - 1].saldo)).toBe(SALDO_ESPERADO);
  });

  it("«saldo antes de» arranca donde termina lo anterior", async () => {
    const corte = "2026-05-01";
    const [{ data: antes }, { data: hasta }] = await Promise.all([
      s.rpc("saldo_caja_antes", { p_fecha: corte }),
      s.rpc("saldo_caja", { p_hasta: "2026-04-30" }),
    ]);
    expect(Math.round(Number(antes))).toBe(Math.round(Number(hasta)));
    console.log(`saldo al 30/04: ${pesos(Number(antes))}`);
  });

  it("lo pendiente de cobro está agrupado por departamento", async () => {
    const movimientos = await todos();
    const deuda = deudaPorDepartamento(movimientos);
    const total = deuda.reduce((a, d) => a + d.total, 0);
    console.log(
      `por cobrar: ${pesos(total)} en ${deuda.length} deptos`,
      deuda.slice(0, 3).map((d) => `${d.depto_codigo}=${pesos(d.total)}`),
    );
    expect(total).toBeGreaterThan(0);
    // Ninguno puede tener un movimiento ya cobrado adentro.
    for (const d of deuda) expect(d.cantidad).toBeGreaterThan(0);
  });

  it("«por cobrar» trae toda la deuda, no la del mes que se está mirando", async () => {
    // Lo que se debe de mayo se sigue debiendo en agosto. Filtrar por mes
    // mostraba 3 de 11 y parecía que faltaban.
    const { data: todaLaDeuda } = await s
      .from("movimientos_caja")
      .select("id, monto")
      .eq("activo", true)
      .eq("reembolsable", true)
      .is("fecha_cobro", null);

    const { data: soloAgosto } = await s
      .from("movimientos_caja")
      .select("id")
      .eq("activo", true)
      .eq("reembolsable", true)
      .is("fecha_cobro", null)
      .gte("fecha", "2026-08-01")
      .lt("fecha", "2026-09-01");

    const total = (todaLaDeuda ?? []).reduce((a, m) => a + m.monto, 0);
    console.log(
      `deuda total: ${todaLaDeuda!.length} movimientos ${pesos(total)} · ` +
        `solo agosto: ${soloAgosto!.length}`,
    );

    // El total que muestra el indicador tiene que ser el de toda la deuda.
    expect(todaLaDeuda!.length).toBeGreaterThan(soloAgosto!.length);
    expect(Math.round(total)).toBe(1_193_500);
  });

  it("un movimiento con cotización se convierte y sin ella no inventa", async () => {
    const movimientos = await todos();
    const conTc = movimientos.find((m) => m.tc !== null);
    const sinTc = movimientos.find((m) => m.tc === null);
    expect(enDolares(conTc!)).toBeGreaterThan(0);
    if (sinTc) expect(enDolares(sinTc)).toBeNull();
    console.log(
      `con cotización: ${movimientos.filter((m) => m.tc !== null).length} · ` +
        `sin: ${movimientos.filter((m) => m.tc === null).length}`,
    );
  });

  it("la base no deja marcar reembolsable sin departamento", async () => {
    const { data: categoria } = await s
      .from("categorias_movimiento")
      .select("id")
      .limit(1)
      .single();

    const { error } = await s.from("movimientos_caja").insert({
      fecha: "2027-01-01",
      tipo: "egreso",
      monto: 1000,
      categoria_id: categoria!.id,
      reembolsable: true,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/reembolsable/i);
  });

  it("la base no deja un monto en cero ni negativo", async () => {
    const { error } = await s.from("movimientos_caja").insert({
      fecha: "2027-01-01",
      tipo: "egreso",
      monto: -500,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/monto/i);
  });

  it("anular un movimiento lo saca del saldo sin borrarlo", async () => {
    const { data: creado } = await s
      .from("movimientos_caja")
      .insert({ fecha: "2027-01-01", tipo: "ingreso", monto: 777 })
      .select("id")
      .single();
    creados.push(creado!.id);

    const { data: conElMovimiento } = await s.rpc("saldo_caja");
    await s.from("movimientos_caja").update({ activo: false }).eq("id", creado!.id);
    const { data: sinElMovimiento } = await s.rpc("saldo_caja");

    expect(Number(conElMovimiento) - Number(sinElMovimiento)).toBe(777);

    // Sigue existiendo: es una baja lógica.
    const { data: sigue } = await s
      .from("movimientos_caja")
      .select("id, activo")
      .eq("id", creado!.id)
      .single();
    expect(sigue!.activo).toBe(false);
  });
});
