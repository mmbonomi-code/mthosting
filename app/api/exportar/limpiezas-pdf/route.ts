import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR, mananaAR } from "@/lib/fechas";
import { formatearHora, TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import { generarPDFLimpiezas, type FilaPDF } from "@/lib/exportar/pdf";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function nombreDelDia(fechaISO: string): string {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return DIAS[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

/**
 * PDF de las limpiezas de una fecha (spec §3.4). Por defecto, las de
 * mañana: el ritmo operativo es anticipado, la lista se manda el día antes.
 */
export async function GET(request: Request) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("No autorizado", { status: 401 });

  const fecha = new URL(request.url).searchParams.get("fecha") ?? mananaAR();

  const { data: limpiezas, error } = await supabase
    .from("limpiezas")
    .select(
      "id, fecha, tipo, hora_checkout, prox_checkin, depto_id, depto:departamentos(codigo, direccion, barrio), responsable:personas(nombre), reserva:reservas(id, noches, fecha_checkout)",
    )
    .eq("fecha", fecha)
    .neq("estado", "cancelada")
    .order("urgente", { ascending: false });

  if (error) return new Response(`Error: ${error.message}`, { status: 500 });

  // Horas coordinadas de salida y de la próxima llegada de cada depto.
  const idsReservas = (limpiezas ?? [])
    .map((l) => l.reserva?.id)
    .filter((id): id is string => !!id);
  const deptos = [...new Set((limpiezas ?? []).map((l) => l.depto_id))];

  const [{ data: salidas }, { data: llegadas }] = await Promise.all([
    idsReservas.length > 0
      ? supabase
          .from("eventos_estadia")
          .select("reserva_id, hora_coordinada")
          .eq("tipo", "checkout")
          .in("reserva_id", idsReservas)
      : Promise.resolve({ data: [] }),
    deptos.length > 0
      ? supabase
          .from("reservas")
          .select(
            "depto_id, fecha_checkin, huesped_nombre, eventos:eventos_estadia(tipo, hora_coordinada)",
          )
          .in("depto_id", deptos)
          .eq("cancelada", false)
          .eq("descartada", false)
          .gte("fecha_checkin", fecha)
      : Promise.resolve({ data: [] }),
  ]);

  const horaSalida = new Map(
    (salidas ?? []).map((e) => [e.reserva_id, e.hora_coordinada]),
  );
  const llegadaPorDeptoFecha = new Map(
    (llegadas ?? []).map((r) => [
      `${r.depto_id}|${r.fecha_checkin}`,
      r.eventos?.find((e) => e.tipo === "checkin")?.hora_coordinada ?? null,
    ]),
  );

  const filas: FilaPDF[] = (limpiezas ?? []).map((l) => {
    const proximo = l.prox_checkin?.slice(0, 10) ?? null;
    const horaLlegada = proximo
      ? llegadaPorDeptoFecha.get(`${l.depto_id}|${proximo}`)
      : null;
    return {
      departamento: l.depto?.codigo ?? "",
      noches: l.reserva?.noches ? String(l.reserva.noches) : "",
      checkout: l.reserva?.fecha_checkout ? formatearFechaAR(l.reserva.fecha_checkout) : "",
      horaCheckout:
        formatearHora(horaSalida.get(l.reserva?.id ?? "") ?? l.hora_checkout) ?? "",
      tipo: TIPOS_LIMPIEZA[l.tipo] ?? l.tipo,
      proxReserva: proximo ? formatearFechaAR(proximo) : "sin reserva",
      proxCheckin: formatearHora(horaLlegada) ?? "",
      direccion: l.depto?.direccion ?? "",
      responsable: l.responsable?.nombre ?? "SIN ASIGNAR",
    };
  });

  const pdf = await generarPDFLimpiezas({
    titulo: `Limpiezas · ${nombreDelDia(fecha)} ${formatearFechaAR(fecha)}`,
    subtitulo: `${filas.length} ${filas.length === 1 ? "limpieza" : "limpiezas"} · ${
      filas.filter((f) => f.responsable === "SIN ASIGNAR").length
    } sin asignar · generado el ${formatearFechaAR(hoyAR())}`,
    filas,
  });

  return new Response(pdf as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="limpiezas-${fecha}.pdf"`,
    },
  });
}
