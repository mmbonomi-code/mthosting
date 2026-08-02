/**
 * Verifica contra la base DEV las consultas de la vista del día y de la
 * ficha del evento, que usan varias claves foráneas a la misma tabla y son
 * las que más fácil fallan en ejecución aunque compilen.
 */
import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/database.types";
import { departamentoListo, type EstadoLimpieza } from "../lib/eventos/reglas";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CAMPOS = `
  id, tipo, fecha_coordinada, hora_coordinada, estado, late_checkout, acceso_dejado,
  punto:puntos_acceso!eventos_estadia_punto_acceso_id_fkey(ubicacion, identificador),
  punto_devolucion:puntos_acceso!eventos_estadia_punto_devolucion_id_fkey(ubicacion, identificador),
  responsable:personas!eventos_estadia_responsable_id_fkey(nombre),
  responsable_devolucion:personas!eventos_estadia_responsable_devolucion_id_fkey(nombre),
  reserva:reservas!inner(
    id, codigo_reserva, huesped_nombre, huesped_contacto, noches, adultos, ninos, bebes,
    fecha_checkin, fecha_checkout, cancelada, descartada, registro_hecho, aviso_seguridad_hecho,
    depto:departamentos(codigo, nombre_interno, direccion, barrio, requiere_registro, requiere_aviso_seguridad)
  )
`;

describe.skipIf(!url || !clave)("vista del día (base dev)", () => {
  const s = createClient<Database>(url!, clave!, { auth: { persistSession: false } });

  it("la consulta del día resuelve las cuatro claves foráneas sin ambigüedad", async () => {
    // Un día con movimiento real: el del corte de los archivos importados.
    const fecha = "2026-08-05";

    const { data, error } = await s
      .from("eventos_estadia")
      .select(CAMPOS)
      .or(`fecha_checkin.eq.${fecha},fecha_checkout.eq.${fecha}`, {
        referencedTable: "reservas",
      })
      .neq("estado", "cancelado");

    expect(error).toBeNull();
    const eventos = data ?? [];
    const llegadas = eventos.filter(
      (e) => e.tipo === "checkin" && e.reserva?.fecha_checkin === fecha,
    );
    const salidas = eventos.filter(
      (e) => e.tipo === "checkout" && e.reserva?.fecha_checkout === fecha,
    );
    console.log(
      `${fecha}: ${llegadas.length} llegadas, ${salidas.length} salidas (${eventos.length} eventos)`,
    );
    expect(eventos.length).toBeGreaterThan(0);

    // Cada evento trae su reserva y su departamento.
    for (const e of eventos.slice(0, 5)) {
      expect(e.reserva).toBeTruthy();
      console.log(
        `  ${e.tipo === "checkin" ? "llega" : "sale "} ${e.reserva?.depto?.codigo?.padEnd(14)} ${e.reserva?.huesped_nombre}`,
      );
    }
  });

  it("la ficha del evento trae todo lo que se necesita en la calle", async () => {
    const { data: evento, error } = await s
      .from("eventos_estadia")
      .select(
        `id, tipo, fecha_coordinada, hora_coordinada, estado, late_checkout, acceso_dejado, observaciones,
         punto_acceso_id, responsable_id, punto_devolucion_id, responsable_devolucion_id,
         reserva:reservas!inner(
           id, codigo_reserva, huesped_nombre, huesped_contacto, noches, adultos, ninos, bebes,
           fecha_checkin, fecha_checkout, cancelada, registro_hecho, aviso_seguridad_hecho, sobre_ok,
           depto:departamentos(
             id, codigo, nombre_interno, direccion, barrio, ambientes, capacidad, wifi_ssid, wifi_pass,
             encargado_nombre, encargado_telefono, indicaciones_acceso, requiere_registro,
             requiere_aviso_seguridad, self_checkout, url_mapa
           )
         )`,
      )
      .eq("tipo", "checkin")
      .not("reserva", "is", null)
      .limit(1)
      .single();

    expect(error).toBeNull();
    expect(evento?.reserva?.depto).toBeTruthy();
    console.log(
      `ficha: ${evento!.reserva!.codigo_reserva} en ${evento!.reserva!.depto!.codigo} — ${evento!.reserva!.depto!.direccion}`,
    );
  });

  it("la regla de departamento listo corre sobre datos reales", async () => {
    const { data: depto } = await s
      .from("departamentos")
      .select("id, codigo")
      .eq("activo", true)
      .limit(1)
      .single();

    const { data: limpiezas } = await s
      .from("limpiezas")
      .select("fecha, estado")
      .eq("depto_id", depto!.id);

    const listo = departamentoListo({
      limpiezas: (limpiezas ?? []) as { fecha: string; estado: EstadoLimpieza }[],
      ultimoCheckout: null,
      fechaLlegada: "2026-12-31",
    });
    console.log(
      `${depto!.codigo}: ${limpiezas?.length ?? 0} limpiezas, listo=${listo} (ninguna terminada todavía)`,
    );
    // Nada está "hecho" aún: la regla tiene que decir que no está listo.
    expect(listo).toBe(false);
  });

  it("el selector unificado arma puntos y personas juntos", async () => {
    const [{ data: puntos }, { data: personas }] = await Promise.all([
      s.from("puntos_acceso").select("id, metodo, ubicacion, sirve_checkin").eq("activo", true),
      s.from("personas").select("id, nombre").eq("hace_checkin", true).eq("activo", true),
    ]);
    console.log(
      `selector: ${(puntos ?? []).length} puntos de acceso + ${(personas ?? []).length} personas`,
    );
    expect(Array.isArray(puntos)).toBe(true);
    expect(Array.isArray(personas)).toBe(true);
  });
});
