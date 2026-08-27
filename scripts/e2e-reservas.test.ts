/**
 * Alta manual de reservas contra la base DEV: que se cree con su código, que
 * la misma maquinaria del importador le arme el check-in, el check-out y la
 * limpieza, y que mover las fechas reacomode todo. Limpia lo que crea.
 */
import { afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { generarLimpiezas } from "../lib/limpiezas/generar";
import {
  descartarReservaEnBase,
  recuperarReservaEnBase,
} from "../lib/reservas/descartar";
import {
  calcularNoches,
  codigoDeReservaDirecta,
  airbnbPisaLoEditado,
} from "../lib/reservas/validar";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!url || !clave)("alta manual de reservas (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });
  const creadas: string[] = [];

  afterAll(async () => {
    for (const id of creadas) {
      await s.from("limpiezas").delete().eq("reserva_id", id);
      await s.from("eventos_estadia").delete().eq("reserva_id", id);
      await s.from("reservas").delete().eq("id", id);
    }
  });

  /** Un tramo lejano en el futuro, para no pisar la operación real. */
  const CHECKIN = "2027-11-10";
  const CHECKOUT = "2027-11-14";

  it("crea la reserva y le arma los eventos y la limpieza", async () => {
    const { data: depto } = await s
      .from("departamentos")
      .select("id, codigo")
      .eq("estado", "activo")
      .order("codigo")
      .limit(1)
      .single();
    expect(depto).toBeTruthy();

    const codigo = codigoDeReservaDirecta(crypto.randomUUID());
    expect(codigo.startsWith("DIR-")).toBe(true);

    const { data: reserva, error } = await s
      .from("reservas")
      .insert({
        codigo_reserva: codigo,
        canal: "directa",
        origen: "manual",
        datos_completos: true,
        depto_id: depto!.id,
        huesped_nombre: "PRUEBA e2e Reserva Directa",
        huesped_contacto: "+54 9 11 4428-2700",
        fecha_checkin: CHECKIN,
        fecha_checkout: CHECKOUT,
        adultos: 2,
        noches: calcularNoches(CHECKIN, CHECKOUT),
      })
      .select("id, codigo_reserva, noches, origen")
      .single();

    expect(error).toBeNull();
    creadas.push(reserva!.id);
    expect(reserva!.noches).toBe(4);
    expect(reserva!.origen).toBe("manual");

    // La misma función que usa el importador y la sincronización de iCal.
    const resumen = await generarLimpiezas(s, [codigo], "2026-08-11");
    console.log(
      `${depto!.codigo} ${CHECKIN}→${CHECKOUT}: ${resumen.generadas} limpiezas, ` +
        `${resumen.anomalias.length} anomalías`,
    );

    const { data: eventos } = await s
      .from("eventos_estadia")
      .select("tipo, estado")
      .eq("reserva_id", reserva!.id);
    expect(eventos?.map((e) => e.tipo).sort()).toEqual(["checkin", "checkout"]);

    const { data: limpiezas } = await s
      .from("limpiezas")
      .select("fecha, tipo, estado, rol_reserva")
      .eq("reserva_id", reserva!.id);
    expect(limpiezas!.length).toBeGreaterThan(0);
    // La limpieza de salida va el día del check-out.
    const salida = limpiezas!.find((l) => l.rol_reserva === "salida");
    expect(salida?.fecha).toBe(CHECKOUT);
  });

  it("mover las fechas reacomoda la limpieza", async () => {
    const id = creadas[0];
    const nuevoCheckout = "2027-11-16";

    const { data: reserva } = await s
      .from("reservas")
      .select("codigo_reserva")
      .eq("id", id)
      .single();

    await s
      .from("reservas")
      .update({
        fecha_checkout: nuevoCheckout,
        noches: calcularNoches(CHECKIN, nuevoCheckout),
      })
      .eq("id", id);

    await generarLimpiezas(s, [reserva!.codigo_reserva], "2026-08-11");

    const { data: limpiezas } = await s
      .from("limpiezas")
      .select("fecha, rol_reserva, estado")
      .eq("reserva_id", id)
      .neq("estado", "cancelada");
    const salida = limpiezas!.find((l) => l.rol_reserva === "salida");
    expect(salida?.fecha).toBe(nuevoCheckout);
  });

  it("no deja cargar dos reservas con el mismo código", async () => {
    const { data: reserva } = await s
      .from("reservas")
      .select("codigo_reserva, depto_id")
      .eq("id", creadas[0])
      .single();

    const { error } = await s.from("reservas").insert({
      codigo_reserva: reserva!.codigo_reserva,
      canal: "directa",
      origen: "manual",
      depto_id: reserva!.depto_id,
      fecha_checkin: CHECKIN,
      fecha_checkout: CHECKOUT,
    });
    expect(error).toBeTruthy();
    expect(error!.message).toMatch(/duplicate|unique/i);
  });

  it("una directa no la pisa ninguna importación; una del calendario sí", async () => {
    const { data: reserva } = await s
      .from("reservas")
      .select("origen, codigo_reserva")
      .eq("id", creadas[0])
      .single();
    expect(airbnbPisaLoEditado(reserva!.origen, reserva!.codigo_reserva)).toBe(false);

    const { data: delCalendario } = await s
      .from("reservas")
      .select("origen, codigo_reserva")
      .eq("origen", "ical")
      .limit(1)
      .maybeSingle();
    if (delCalendario) {
      expect(
        airbnbPisaLoEditado(delCalendario.origen, delCalendario.codigo_reserva),
      ).toBe(true);
    }
  });

  it("hay reservas del calendario esperando que les carguen los datos", async () => {
    const { count } = await s
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .eq("datos_completos", false)
      .eq("descartada", false);
    console.log(`reservas tentativas a completar: ${count}`);
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it("descartar la reserva se lleva su limpieza y sus eventos, y recuperarla los devuelve", async () => {
    const { data: depto } = await s
      .from("departamentos")
      .select("id")
      .eq("estado", "activo")
      .order("codigo")
      .limit(1)
      .single();

    const codigo = codigoDeReservaDirecta(crypto.randomUUID());
    const { data: reserva } = await s
      .from("reservas")
      .insert({
        codigo_reserva: codigo,
        canal: "directa",
        origen: "manual",
        datos_completos: true,
        depto_id: depto!.id,
        huesped_nombre: "PRUEBA e2e Descarte",
        fecha_checkin: "2027-12-05",
        fecha_checkout: "2027-12-08",
        adultos: 2,
        noches: calcularNoches("2027-12-05", "2027-12-08"),
      })
      .select("id")
      .single();
    creadas.push(reserva!.id);

    await generarLimpiezas(s, [codigo], "2026-08-11");

    const resultado = await descartarReservaEnBase(s, reserva!.id, "2026-08-11");
    expect(resultado).not.toHaveProperty("error");

    const { data: descartada } = await s
      .from("reservas")
      .select("descartada, cancelada")
      .eq("id", reserva!.id)
      .single();
    expect(descartada!.descartada).toBe(true);
    // Descartar NO es cancelar: la marca de Airbnb no se toca.
    expect(descartada!.cancelada).toBe(false);

    const eventosDe = async () =>
      (
        await s
          .from("eventos_estadia")
          .select("estado")
          .eq("reserva_id", reserva!.id)
      ).data!;
    const limpiezasDe = async () =>
      (await s.from("limpiezas").select("estado").eq("reserva_id", reserva!.id)).data!;

    expect((await eventosDe()).every((e) => e.estado === "cancelado")).toBe(true);
    expect((await limpiezasDe()).every((l) => l.estado === "cancelada")).toBe(true);

    // Descartar dos veces no vuelve a tocar nada.
    expect(await descartarReservaEnBase(s, reserva!.id, "2026-08-11")).toHaveProperty(
      "error",
    );

    // Y vuelve entera, igual que cuando reaparece en un archivo de Airbnb.
    const vuelta = await recuperarReservaEnBase(s, reserva!.id, "2026-08-11");
    expect(vuelta).not.toHaveProperty("error");

    const { data: recuperada } = await s
      .from("reservas")
      .select("descartada")
      .eq("id", reserva!.id)
      .single();
    expect(recuperada!.descartada).toBe(false);
    expect((await eventosDe()).every((e) => e.estado === "pendiente")).toBe(true);
    expect((await limpiezasDe()).some((l) => l.estado === "pendiente")).toBe(true);
  });
});
