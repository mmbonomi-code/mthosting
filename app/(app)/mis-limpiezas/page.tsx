import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerMisLimpiezas, miPersonaId } from "@/lib/limpiezas/permisos";
import { hoyAR, mananaAR, sumarDias, formatearFechaAR } from "@/lib/fechas";
import { diasSinLimpiar } from "@/lib/limpiezas/diasSinLimpiar";
import { ultimaLimpiezaDelDepto } from "@/lib/limpiezas/ultimaLimpieza";
import { TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import SinPermiso from "@/app/componentes/SinPermiso";

const DIAS_ATRAS = 15;

const ETIQUETA_ESTADO: Record<string, string> = {
  asignada: "Asignada",
  en_curso: "En curso",
  hecha: "Terminada",
  verificada: "Terminada",
};
const TONO_ESTADO: Record<string, string> = {
  asignada: "bg-sky-950 text-sky-300",
  en_curso: "bg-amber-950 text-amber-300",
  hecha: "bg-emerald-950 text-emerald-300",
  verificada: "bg-emerald-950 text-emerald-300",
};

export default async function MisLimpiezas({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { fecha } = await searchParams;
  const supabase = await crearClienteServidor();

  if (!(await puedeVerMisLimpiezas(supabase))) {
    return (
      <SinPermiso
        titulo="Mis limpiezas"
        motivo="Esta pantalla es para el personal que limpia, y para gobernanta, manager y administración."
      />
    );
  }

  const miId = await miPersonaId(supabase);
  if (!miId) {
    return (
      <SinPermiso
        titulo="Mis limpiezas"
        motivo="Tu usuario no tiene una ficha de persona asociada. Pedile a administración que la revise."
      />
    );
  }

  const hoy = hoyAR();
  const manana = mananaAR();
  const minFecha = sumarDias(hoy, -DIAS_ATRAS);
  const fechaElegida = fecha && fecha >= minFecha && fecha <= manana ? fecha : manana;

  const { data: limpiezas } = await supabase
    .from("limpiezas")
    .select(
      "id, tipo, estado, urgente, prox_checkin, depto_id, monto_pactado, moneda, depto:departamentos(codigo, barrio), reserva:reservas(noches)",
    )
    .eq("asignado_a", miId)
    .eq("fecha", fechaElegida)
    .neq("estado", "cancelada")
    .order("prox_checkin", { ascending: true, nullsFirst: false });

  const lista = limpiezas ?? [];

  const diasSin = await Promise.all(
    lista.map((l) => ultimaLimpiezaDelDepto(supabase, l.depto_id, fechaElegida)),
  );

  const esManana = fechaElegida === manana;
  const esMinimo = fechaElegida === minFecha;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Mis limpiezas</h1>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Link
            href={`/mis-limpiezas?fecha=${sumarDias(fechaElegida, -1)}`}
            aria-label="Día anterior"
            className={`flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800 ${esMinimo ? "pointer-events-none opacity-25" : ""}`}
          >
            ←
          </Link>
          <div className="text-center">
            <p className="text-lg font-medium text-white">
              {esManana ? "Mañana" : formatearFechaAR(fechaElegida)}
            </p>
            {!esManana && (
              <Link href="/mis-limpiezas" className="text-xs text-slate-500 hover:text-slate-300">
                Volver a mañana
              </Link>
            )}
          </div>
          <Link
            href={`/mis-limpiezas?fecha=${sumarDias(fechaElegida, 1)}`}
            aria-label="Día siguiente"
            className={`flex h-11 w-11 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800 ${esManana ? "pointer-events-none opacity-25" : ""}`}
          >
            →
          </Link>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="py-12 text-center text-slate-500">
          {esManana ? "No tenés limpiezas para mañana." : "No tenías limpiezas ese día."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((l, i) => (
            <li key={l.id}>
              <Link
                href={`/mis-limpiezas/${l.id}`}
                className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-800/40 p-4 transition-colors hover:bg-slate-800/70"
              >
                <div>
                  <p className="text-base font-semibold text-white">{l.depto?.codigo}</p>
                  <p className="text-sm text-slate-400">
                    {l.depto?.barrio} · {TIPOS_LIMPIEZA[l.tipo] ?? l.tipo}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${TONO_ESTADO[l.estado] ?? "bg-slate-800 text-slate-300"}`}>
                    {ETIQUETA_ESTADO[l.estado] ?? l.estado}
                  </span>
                  {(l.reserva?.noches ?? 0) >= 10 && (
                    <span className="rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-medium text-amber-300">
                      {l.reserva!.noches} noches
                    </span>
                  )}
                  <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400">
                    {diasSin[i] ? `${diasSinLimpiar(diasSin[i]!.fecha, fechaElegida)} días sin limpiarse` : "sin limpiezas previas"}
                  </span>
                  {l.urgente && (
                    <span className="rounded-full bg-orange-950 px-2.5 py-0.5 text-xs font-semibold text-orange-300">
                      Entra alguien ese día
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
