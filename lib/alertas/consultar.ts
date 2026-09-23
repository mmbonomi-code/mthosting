/**
 * Trae los datos de las 7 listas del panel de alertas (spec §3.6) y les
 * aplica la detección pura.
 *
 * Un solo lugar para las queries: lo usan tanto la pantalla `/alertas` (que
 * necesita el detalle) como el contador del menú (que solo necesita cuántas
 * hay). Ninguno de los dos reimplementa el cálculo — los dos llaman acá.
 *
 * Todo se recalcula en cada visita, nada queda guardado (mismo criterio que
 * económico: un total guardado puede quedar viejo, uno recalculado no).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { hoyAR, sumarDias } from "@/lib/fechas";
import { limpiezasEnMedioDeEstadia, type Alerta } from "@/lib/limpiezas/alertas";
import { semaforoDeLimpieza, type Semaforo } from "@/lib/limpiezas/semaforo";
import {
  arreglosSinResolver,
  conflictosCancelacionOFecha,
  conflictosLateCheckout,
  detectarFaltaLimpieza,
  ventanasInsuficientesGlobal,
  type AlertaVentana,
  type ConflictoLate,
  type ConflictoReserva,
  type FaltaLimpieza,
  type MovimientoVentana,
  type ReservaCobertura,
  type ReservaLate,
} from "@/lib/alertas/detectar";
import {
  alertasDeArreglos,
  alertasDeFotos,
  reservaAReclamar,
  type AlertaArreglo,
  type AlertaFotos,
  type LimpiezaDeFoto,
  type ReservaDelDepto,
} from "@/lib/alertas/fotos";
import {
  alertasDelCalendario,
  type FilaCambioCalendario,
  type ProblemaCalendario,
} from "@/lib/alertas/calendario";

export type FilaSinResponsable = {
  id: string;
  depto_id: string;
  fecha: string;
  tipo: string;
  semaforo: Semaforo;
};

export type PanelAlertas = {
  desde: string;
  hasta: string;
  estadiaOcupada: Alerta[];
  ventanaInsuficiente: AlertaVentana[];
  faltaLimpieza: FaltaLimpieza[];
  sinResponsable: FilaSinResponsable[];
  sinDepto: number;
  conflictos: ConflictoReserva[];
  lateCheckout: ConflictoLate[];
  /** Lo que la limpieza reportó para arreglar: una fila por limpieza. */
  arreglos: AlertaArreglo[];
  /** Fotos de daño del huésped que todavía no derivaron en un reclamo. */
  danioHuesped: FilaDanioHuesped[];
  /** Cosas que el huésped se olvidó y nadie miró todavía. */
  olvidos: AlertaFotos[];
  /** Lo que el calendario de Airbnb sugiere y nadie confirmó todavía. */
  cambiosCalendario: FilaCambioCalendario[];
  /** Calendarios que no se leyeron, desapariciones frenadas, sync parada. */
  problemasCalendario: ProblemaCalendario[];
};

export type FilaDanioHuesped = AlertaFotos & {
  /** A quién se le reclama. Null si no se pudo determinar: ahí se entra a mano. */
  reserva: { id: string; codigo_reserva: string } | null;
  /** Lo que escribió quien limpió. Sin esto, la fila es solo "3 fotos". */
  descripcion: string | null;
};

export async function calcularPanelAlertas(
  supabase: SupabaseClient<Database>,
): Promise<PanelAlertas> {
  const hoy = hoyAR();
  const desde = sumarDias(hoy, -3);
  const hasta = sumarDias(hoy, 21);
  // Las fotos que piden acción tienen su propia ventana, mucho más larga: un
  // daño de hace tres semanas que nadie miró todavía sigue siendo urgente
  // (Airbnb da 14 días para reclamar). Más atrás de dos meses ya no es una
  // alerta, es historia.
  const desdeFotos = sumarDias(hoy, -60);

  const [
    { data: parametros },
    { data: reservasVentana },
    { data: limpiezasIntocables },
    { data: limpiezasRango },
    { data: reservasRango },
    { data: sinResponsableCruda },
    { count: sinDepto },
    { data: arreglosCrudos },
    { data: fotosAccion },
    { data: revisadas },
    { data: reclamosExistentes },
    calendario,
  ] = await Promise.all([
    supabase.from("parametros_operativos").select("clave, valor"),
    supabase
      .from("reservas")
      .select(
        `id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout,
         eventos:eventos_estadia(
           id, tipo, fecha_coordinada, hora_coordinada, late_checkout,
           punto:puntos_acceso!eventos_estadia_punto_acceso_id_fkey(metodo)
         )`,
      )
      .not("depto_id", "is", null)
      .eq("cancelada", false)
      .eq("descartada", false)
      .or(
        `and(fecha_checkin.gte.${desde},fecha_checkin.lte.${hasta}),and(fecha_checkout.gte.${desde},fecha_checkout.lte.${hasta})`,
      ),
    supabase
      .from("limpiezas")
      .select(
        `id, depto_id, fecha, estado, rol_reserva, reserva_id, conflicto_resuelto,
         reserva:reservas(id, codigo_reserva, cancelada, descartada, fecha_checkin, fecha_checkout)`,
      )
      .in("estado", ["en_curso", "hecha", "verificada"])
      .gte("fecha", desde),
    supabase
      .from("limpiezas")
      .select("id, depto_id, fecha, tipo, estado")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .neq("estado", "cancelada"),
    supabase
      .from("reservas")
      .select("depto_id, codigo_reserva, fecha_checkin, fecha_checkout, cancelada, descartada")
      .eq("cancelada", false)
      .eq("descartada", false)
      .lte("fecha_checkin", hasta)
      .gte("fecha_checkout", desde),
    supabase
      .from("limpiezas")
      .select("id, depto_id, fecha, tipo, estado, asignado_a")
      .is("asignado_a", null)
      .neq("estado", "cancelada")
      .gte("fecha", desde)
      .lte("fecha", hasta),
    supabase
      .from("reservas")
      .select("id", { count: "exact", head: true })
      .is("depto_id", null)
      .eq("descartada", false),
    // Sin ventana de fechas: un arreglo reportado hace un mes y nunca
    // resuelto sigue siendo un arreglo pendiente.
    supabase
      .from("arreglos")
      .select("id, depto_id, limpieza_id, descripcion, estado, activo, created_at")
      .eq("activo", true)
      .not("limpieza_id", "is", null),
    // Las tres categorías que piden acción. La única que queda afuera es
    // "depto terminado", que no le pide nada a nadie.
    supabase
      .from("limpieza_fotos")
      .select("limpieza_id, tipo, created_at")
      .in("tipo", ["huesped", "olvido", "arreglar"])
      .gte("created_at", desdeFotos + "T00:00:00Z"),
    supabase.from("alerta_revisada").select("clase, limpieza_id, firma"),
    // Los reclamos son pocos (decenas por año): traerlos enteros sale más
    // barato que una segunda vuelta con la lista de reservas candidatas.
    supabase.from("reclamos").select("reserva_id"),
    alertasDelCalendario(supabase, hoy),
  ]);

  const config = Object.fromEntries((parametros ?? []).map((p) => [p.clave, p.valor]));
  const umbrales = {
    horaLimiteCheckout: config.hora_limite_checkout ?? "11:00",
    horaMinimaCheckin: config.hora_minima_checkin ?? "12:00",
  };

  // --- 0.b y 1 y 5: se derivan todas de la misma query de reservas en ventana ---
  const movimientos: MovimientoVentana[] = [];
  const cobertura: ReservaCobertura[] = [];
  const late: ReservaLate[] = [];
  const idsReservaVentana: string[] = [];

  for (const r of reservasVentana ?? []) {
    if (!r.depto_id || !r.fecha_checkin || !r.fecha_checkout) continue;
    idsReservaVentana.push(r.id);

    const eventoCheckout = r.eventos?.find((e) => e.tipo === "checkout");
    const eventoCheckin = r.eventos?.find((e) => e.tipo === "checkin");

    movimientos.push({
      reserva_id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      tipo: "checkout",
      fecha: eventoCheckout?.fecha_coordinada ?? r.fecha_checkout,
      hora: eventoCheckout?.hora_coordinada ?? null,
    });
    movimientos.push({
      reserva_id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      tipo: "checkin",
      fecha: eventoCheckin?.fecha_coordinada ?? r.fecha_checkin,
      hora: eventoCheckin?.hora_coordinada ?? null,
      // Llegar temprano a dejar las valijas no acorta la ventana.
      soloValijas: eventoCheckin?.punto?.metodo === "valijas",
    });

    cobertura.push({
      id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
    });

    late.push({
      id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
      lateCheckout: eventoCheckout?.late_checkout ?? false,
    });
  }

  const ventanaInsuficiente = ventanasInsuficientesGlobal(movimientos, umbrales);

  const deptosEnVentana = [...new Set(cobertura.map((r) => r.depto_id))];

  const [{ data: limpiezasCobertura }, { data: contextoDepto }] = await Promise.all([
    idsReservaVentana.length > 0
      ? supabase
          .from("limpiezas")
          .select("reserva_id, rol_reserva, estado")
          .in("reserva_id", idsReservaVentana)
      : Promise.resolve({
          data: [] as { reserva_id: string | null; rol_reserva: string | null; estado: string }[],
        }),
    // Sin cota de fecha hacia atrás a propósito: para saber si una reserva es
    // "la primera del depto" hace falta el check-out anterior, sea de cuando
    // sea, no solo el que cae dentro de la ventana de 24 días.
    deptosEnVentana.length > 0
      ? supabase
          .from("reservas")
          .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout")
          .in("depto_id", deptosEnVentana)
          .eq("cancelada", false)
          .eq("descartada", false)
          .lte("fecha_checkout", hasta)
      : Promise.resolve({ data: [] as ReservaCobertura[] }),
  ]);

  const contexto: ReservaCobertura[] = (contextoDepto ?? [])
    .filter(
      (r): r is typeof r & { depto_id: string; fecha_checkin: string; fecha_checkout: string } =>
        r.depto_id !== null && r.fecha_checkin !== null && r.fecha_checkout !== null,
    )
    .map((r) => ({
      id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
    }));

  const faltaLimpieza = detectarFaltaLimpieza(
    cobertura,
    contexto,
    (limpiezasCobertura ?? []) as {
      reserva_id: string | null;
      rol_reserva: "salida" | "entrada" | "durante" | null;
      estado: string;
    }[],
  );

  const lateCheckout = conflictosLateCheckout(late);

  // --- 4: limpiezas intocables cuya reserva se movió por debajo ---
  const reservasDeIntocables = new Map<
    string,
    {
      id: string;
      codigo_reserva: string;
      cancelada: boolean;
      descartada: boolean;
      fecha_checkin: string | null;
      fecha_checkout: string | null;
    }
  >();
  for (const l of limpiezasIntocables ?? []) {
    if (l.reserva && !reservasDeIntocables.has(l.reserva.id)) {
      reservasDeIntocables.set(l.reserva.id, l.reserva);
    }
  }
  const conflictos = conflictosCancelacionOFecha(
    (limpiezasIntocables ?? []).map((l) => ({
      id: l.id,
      depto_id: l.depto_id,
      fecha: l.fecha,
      estado: l.estado,
      rol_reserva: l.rol_reserva,
      reserva_id: l.reserva_id,
      conflicto_resuelto: l.conflicto_resuelto,
    })),
    [...reservasDeIntocables.values()],
  );

  // --- 0: limpieza sobre estadía ocupada (reutiliza lib/limpiezas/alertas.ts) ---
  const estadiaOcupada = limpiezasEnMedioDeEstadia(
    (limpiezasRango ?? []).map((l) => ({
      id: l.id,
      depto_id: l.depto_id,
      fecha: l.fecha,
      tipo: l.tipo,
      estado: l.estado,
    })),
    (reservasRango ?? []).map((r) => ({
      depto_id: r.depto_id,
      codigo_reserva: r.codigo_reserva,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
      cancelada: r.cancelada,
      descartada: r.descartada,
    })),
  ).filter((a) => a.motivo === "en_medio_de_estadia");

  // --- 2: sin responsable, solo semáforo rojo o ámbar ---
  // Solo hoy y lo que ya quedó atrasado (decisión del dueño, 29/08/2026).
  // Antes entraban también las de los días siguientes y la lista quedaba
  // llena de cosas que todavía había tiempo de asignar: el aviso perdía
  // sentido y se ignoraba. Lo de mañana en adelante se reparte desde
  // /semana, que es la pantalla hecha para eso.
  const sinResponsable: FilaSinResponsable[] = (sinResponsableCruda ?? [])
    .filter((l) => l.fecha <= hoy)
    .map((l) => ({
      id: l.id,
      depto_id: l.depto_id,
      fecha: l.fecha,
      tipo: l.tipo,
      semaforo: semaforoDeLimpieza({ fecha: l.fecha, hoy, tieneResponsable: false }),
    }));

  // --- Fotos de limpieza que piden acción: daño del huésped y olvidos ---
  // (decisión del dueño, 02/09/2026). Una alerta por limpieza, no por foto.
  const arreglosPendientes = arreglosSinResolver(arreglosCrudos ?? []);
  const idsLimpiezaFoto = [
    ...new Set([
      ...(fotosAccion ?? []).map((f) => f.limpieza_id),
      // También las de los arreglos abiertos: la fecha buena de la alerta es
      // la de la limpieza, no la del día en que se cargó el arreglo.
      ...arreglosPendientes.map((a) => a.limpieza_id),
    ]),
  ];
  const { data: limpiezasDeFoto } =
    idsLimpiezaFoto.length > 0
      ? await supabase
          .from("limpiezas")
          .select("id, depto_id, fecha, tipo, rol_reserva, reserva_id, danio_huesped")
          .in("id", idsLimpiezaFoto)
      : { data: [] as LimpiezaDeFoto[] };

  const limpiezasFoto: LimpiezaDeFoto[] = limpiezasDeFoto ?? [];
  const deptosDeFoto = [...new Set(limpiezasFoto.map((l) => l.depto_id))];

  const { data: reservasDeFoto } =
    deptosDeFoto.length > 0
      ? await supabase
          .from("reservas")
          .select("id, codigo_reserva, depto_id, fecha_checkin, fecha_checkout")
          .in("depto_id", deptosDeFoto)
          .eq("cancelada", false)
          .eq("descartada", false)
          .gte("fecha_checkout", desdeFotos)
      : { data: [] };

  const reservasFoto: ReservaDelDepto[] = (reservasDeFoto ?? [])
    .filter(
      (r): r is typeof r & { depto_id: string; fecha_checkin: string; fecha_checkout: string } =>
        r.depto_id !== null && r.fecha_checkin !== null && r.fecha_checkout !== null,
    )
    .map((r) => ({
      id: r.id,
      codigo_reserva: r.codigo_reserva,
      depto_id: r.depto_id,
      fecha_checkin: r.fecha_checkin,
      fecha_checkout: r.fecha_checkout,
    }));

  const conReclamo = new Set(
    (reclamosExistentes ?? []).map((r) => r.reserva_id).filter((id): id is string => id !== null),
  );
  const limpiezaFotoPorId = new Map(limpiezasFoto.map((l) => [l.id, l]));

  const danioHuesped: FilaDanioHuesped[] = alertasDeFotos(
    "huesped",
    fotosAccion ?? [],
    limpiezasFoto,
    revisadas ?? [],
  )
    .map((a) => {
      const limpieza = limpiezaFotoPorId.get(a.limpieza_id);
      const reserva = limpieza ? reservaAReclamar(limpieza, reservasFoto) : null;
      return {
        ...a,
        reserva: reserva ? { id: reserva.id, codigo_reserva: reserva.codigo_reserva } : null,
        descripcion: limpieza?.danio_huesped ?? null,
      };
    })
    // Con el reclamo ya creado el tema está encarado: sigue su curso en
    // /reclamos, que tiene su propio semáforo de plazo. Acá queda solo lo
    // que todavía no agarró nadie.
    .filter((f) => !(f.reserva && conReclamo.has(f.reserva.id)));

  const olvidos = alertasDeFotos("olvido", fotosAccion ?? [], limpiezasFoto, revisadas ?? []);

  const arreglos = alertasDeArreglos(
    arreglosPendientes,
    fotosAccion ?? [],
    limpiezasFoto,
    revisadas ?? [],
  );

  return {
    desde,
    hasta,
    estadiaOcupada,
    ventanaInsuficiente,
    faltaLimpieza,
    sinResponsable,
    sinDepto: sinDepto ?? 0,
    conflictos,
    lateCheckout,
    arreglos,
    danioHuesped,
    olvidos,
    cambiosCalendario: calendario.cambios,
    problemasCalendario: calendario.problemas,
  };
}

export function contarCriticas(panel: PanelAlertas): number {
  // Los arreglos van acá y no en el resto: se pidieron en rojo (decisión del
  // dueño, 29/08/2026). Alguien vio algo roto en un departamento y hasta que
  // no se resuelve sigue roto.
  // El daño del huésped va en rojo junto con los arreglos (decisión del
  // dueño, 02/09/2026): hay plata en juego y Airbnb da 14 días.
  return (
    panel.estadiaOcupada.length +
    panel.ventanaInsuficiente.length +
    panel.arreglos.length +
    panel.danioHuesped.length +
    // Una cancelación de mañana sin confirmar es alguien que va a limpiar, o
    // a esperar a un huésped, para nada.
    panel.cambiosCalendario.filter((c) => c.urgente).length
  );
}

export function contarResto(panel: PanelAlertas): number {
  return (
    panel.faltaLimpieza.length +
    panel.sinResponsable.length +
    panel.sinDepto +
    panel.conflictos.length +
    panel.lateCheckout.length +
    panel.olvidos.length +
    panel.cambiosCalendario.filter((c) => !c.urgente).length +
    panel.problemasCalendario.length
  );
}
