import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR, hoyAR, sumarDias } from "@/lib/fechas";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import { TIPOS_LIMPIEZA, formatearHora } from "@/lib/limpiezas/etiquetas";
import { clsBotonPrimario } from "@/lib/ui";

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** Nombre del día de una fecha `yyyy-mm-dd`, sin zonas horarias de por medio. */
function nombreDelDia(fechaISO: string): string {
  const [a, m, d] = fechaISO.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
}

export default async function Limpiezas({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; dias?: string }>;
}) {
  const params = await searchParams;
  const hoy = hoyAR();
  const desde = params.desde ?? hoy;
  const dias = Math.min(31, Math.max(1, Number.parseInt(params.dias ?? "7", 10) || 7));
  const hasta = sumarDias(desde, dias - 1);

  const supabase = await crearClienteServidor();

  const { data: limpiezas } = await supabase
    .from("limpiezas")
    .select(
      "id, fecha, tipo, urgente, estado, prox_checkin, hora_checkout, depto_id, depto:departamentos(codigo, barrio, ambientes), responsable:personas(nombre), reserva:reservas(id, codigo_reserva, huesped_nombre, noches, fecha_checkout)",
    )
    .gte("fecha", desde)
    .lte("fecha", hasta)
    .neq("estado", "cancelada")
    .order("fecha")
    .order("urgente", { ascending: false });

  // Horarios coordinados: la salida de cada reserva y la llegada del próximo
  // huésped del mismo departamento.
  const idsReservas = (limpiezas ?? [])
    .map((l) => l.reserva?.id)
    .filter((id): id is string => !!id);
  const deptos = [...new Set((limpiezas ?? []).map((l) => l.depto_id))];

  const [{ data: eventosSalida }, { data: llegadas }] = await Promise.all([
    idsReservas.length > 0
      ? supabase
          .from("eventos_estadia")
          .select("reserva_id, fecha_coordinada, hora_coordinada")
          .eq("tipo", "checkout")
          .in("reserva_id", idsReservas)
      : Promise.resolve({ data: [] }),
    deptos.length > 0
      ? supabase
          .from("reservas")
          .select("depto_id, fecha_checkin, eventos:eventos_estadia(tipo, hora_coordinada)")
          .in("depto_id", deptos)
          .eq("cancelada", false)
          .eq("descartada", false)
          .gte("fecha_checkin", desde)
          .lte("fecha_checkin", sumarDias(hasta, 1))
      : Promise.resolve({ data: [] }),
  ]);

  const salidaPorReserva = new Map(
    (eventosSalida ?? []).map((e) => [
      e.reserva_id,
      { fecha: e.fecha_coordinada, hora: e.hora_coordinada },
    ]),
  );
  const horaLlegadaPorDeptoFecha = new Map(
    (llegadas ?? []).map((r) => [
      `${r.depto_id}|${r.fecha_checkin}`,
      r.eventos?.find((e) => e.tipo === "checkin")?.hora_coordinada ?? null,
    ]),
  );

  const porDia = new Map<string, NonNullable<typeof limpiezas>>();
  for (const l of limpiezas ?? []) {
    if (!porDia.has(l.fecha)) porDia.set(l.fecha, []);
    porDia.get(l.fecha)!.push(l);
  }

  const sinResponsable = (limpiezas ?? []).filter((l) => !l.responsable).length;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Limpiezas
            <span className="ml-2 text-base font-normal text-slate-500">
              {limpiezas?.length ?? 0}
            </span>
          </h1>
          <p className="text-sm text-slate-400">
            {formatearFechaAR(desde)} al {formatearFechaAR(hasta)}
            {sinResponsable > 0 && (
              <span className="text-amber-400"> · {sinResponsable} sin asignar</span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href={`/limpiezas?desde=${sumarDias(desde, -dias)}&dias=${dias}`}
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            ←
          </Link>
          <Link
            href="/limpiezas"
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            Hoy
          </Link>
          <Link
            href={`/limpiezas?desde=${sumarDias(desde, dias)}&dias=${dias}`}
            className="rounded-lg border border-slate-700 px-3 py-2 text-slate-300 hover:bg-slate-800"
          >
            →
          </Link>
          <Link href="/limpiezas/nueva" className={`${clsBotonPrimario} flex items-center`}>
            + Nueva
          </Link>
        </div>
      </div>

      {porDia.size === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-12 text-center">
          <p className="text-slate-300">No hay limpiezas en este período.</p>
          <p className="mt-1 text-sm text-slate-500">
            Se generan solas al importar las reservas.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {[...porDia.entries()].map(([fecha, delDia]) => {
            const faltanAsignar = delDia.filter((l) => !l.responsable).length;
            return (
              /* Un día por fila; se despliega para ver sus limpiezas. El de
                 hoy arranca abierto porque es el que se mira primero. */
              <details
                key={fecha}
                open={fecha === hoy}
                className="group rounded-xl border border-slate-800 bg-slate-800/30"
              >
                <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 [&::-webkit-details-marker]:hidden">
                  <span className="font-medium capitalize text-white">
                    {nombreDelDia(fecha)} {formatearFechaAR(fecha)}
                  </span>
                  <span className="text-sm text-slate-400">
                    {delDia.length} {delDia.length === 1 ? "limpieza" : "limpiezas"}
                  </span>
                  {faltanAsignar > 0 && (
                    <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-xs font-medium text-red-300">
                      {faltanAsignar} sin asignar
                    </span>
                  )}
                  {fecha === hoy && (
                    <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-200">
                      hoy
                    </span>
                  )}
                  <span className="ml-auto text-slate-500 transition-transform group-open:rotate-180">
                    ▾
                  </span>
                </summary>

                <ul className="flex flex-col gap-2 border-t border-slate-800 p-3">
                  {delDia.map((l) => {
                    const proximo = l.prox_checkin?.slice(0, 10) ?? null;
                    const mismoDia = proximo === l.fecha;
                    const salida = l.reserva ? salidaPorReserva.get(l.reserva.id) : null;
                    // La salida coordinada manda; si no hay, la de la reserva.
                    const fechaSalida = salida?.fecha ?? l.reserva?.fecha_checkout ?? null;
                    const horaSalida = formatearHora(salida?.hora ?? l.hora_checkout);
                    const horaLlegada = proximo
                      ? formatearHora(horaLlegadaPorDeptoFecha.get(`${l.depto_id}|${proximo}`))
                      : null;
                    const salidaOtroDia = fechaSalida && fechaSalida !== l.fecha;

                    return (
                      <li key={l.id}>
                        <Link
                          href={`/limpiezas/${l.id}`}
                          className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border-y border-r border-y-slate-800 border-r-slate-800 border-l-4 bg-slate-800/40 px-4 py-3 transition-colors hover:border-y-slate-600 hover:border-r-slate-600 ${
                            mismoDia ? "border-l-red-500" : "border-l-slate-700"
                          }`}
                        >
                          <span className="w-32 shrink-0 font-mono text-sm font-semibold text-white">
                            {l.depto?.codigo}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-slate-300">
                              {TIPOS_LIMPIEZA[l.tipo] ?? l.tipo}
                              {l.depto?.ambientes &&
                                ` · ${ETIQUETA_AMBIENTES[l.depto.ambientes]}`}
                              {l.depto?.barrio && ` · ${l.depto.barrio}`}
                              {/* Cuántas noches estuvo el huésped que se va:
                                  la mejor señal de cómo quedó el depto. */}
                              {l.reserva?.noches ? ` · ${l.reserva.noches} noches` : ""}
                            </span>
                            <span className="block text-xs text-slate-500">
                              {fechaSalida
                                ? `sale ${salidaOtroDia ? formatearFechaAR(fechaSalida) + " " : ""}${horaSalida ?? "sin hora"}`
                                : null}
                              {fechaSalida && proximo ? " → " : null}
                              {proximo
                                ? `entra ${mismoDia ? "" : formatearFechaAR(proximo) + " "}${horaLlegada ?? (mismoDia ? "sin hora" : "")}`
                                : null}
                            </span>
                          </span>
                          {mismoDia && (
                            <span className="rounded-full bg-red-950 px-2.5 py-0.5 text-xs font-medium text-red-300">
                              Check in/out
                            </span>
                          )}
                          <span className="text-sm text-slate-400">
                            {l.responsable?.nombre ?? (
                              <span className="text-amber-400">Sin responsable</span>
                            )}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </main>
  );
}
