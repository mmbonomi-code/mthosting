import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerMisLimpiezas, miPersonaId } from "@/lib/limpiezas/permisos";
import { hoyAR, mananaAR, sumarDias, formatearFechaAR } from "@/lib/fechas";
import { diasSinLimpiar } from "@/lib/limpiezas/diasSinLimpiar";
import { ultimaLimpiezaDelDepto } from "@/lib/limpiezas/ultimaLimpieza";
import { TIPOS_LIMPIEZA } from "@/lib/limpiezas/etiquetas";
import { traerInteracciones } from "@/lib/limpiezas/interaccion-db";
import { claveOrden } from "@/lib/limpiezas/interaccion";
import InteraccionHuespedes from "./InteraccionHuespedes";
import SinPermiso from "@/app/componentes/SinPermiso";
import Badge from "@/app/componentes/Badge";
import { TONO_LIMPIEZA, type EstadoLimpieza } from "@/lib/estados";

const DIAS_ATRAS = 15;

// Las palabras del personal de limpieza, no las de la oficina. El color sí
// es el de todas las limpiezas (lib/estados.ts).
const ETIQUETA_ESTADO: Record<string, string> = {
  asignada: "Asignada",
  en_curso: "En curso",
  hecha: "Terminada",
  verificada: "Terminada",
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
  // Abre en HOY (decisión del dueño, 27/08/2026). La spec decía "mañana",
  // pensando en que la lista se manda la noche anterior; en el uso real la
  // pantalla se abre durante el día para marcar lo que se va terminando, y
  // aterrizar en mañana hacía parecer que no había nada. Mañana sigue a un
  // toque de la flecha.
  const fechaElegida = fecha && fecha >= minFecha && fecha <= manana ? fecha : hoy;

  const { data: limpiezas } = await supabase
    .from("limpiezas")
    .select(
      "id, tipo, estado, fecha, prox_checkin, hora_checkout, depto_id, reserva_id, rol_reserva, depto:departamentos(codigo, barrio), reserva:reservas(noches)",
    )
    .eq("asignado_a", miId)
    .eq("fecha", fechaElegida)
    .neq("estado", "cancelada")
    .order("prox_checkin", { ascending: true, nullsFirst: false });

  const interacciones = await traerInteracciones(supabase, limpiezas ?? []);

  // Primero los deptos donde entra alguien ese día, por hora de entrada: son
  // los que no tienen margen.
  const lista = [...(limpiezas ?? [])].sort((a, b) =>
    claveOrden(interacciones.get(a.id)!).localeCompare(claveOrden(interacciones.get(b.id)!)),
  );

  const diasSin = await Promise.all(
    lista.map((l) => ultimaLimpiezaDelDepto(supabase, l.depto_id, fechaElegida)),
  );

  const esHoy = fechaElegida === hoy;
  const esManana = fechaElegida === manana;
  const esMinimo = fechaElegida === minFecha;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Mis limpiezas</h1>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Link
            href={`/mis-limpiezas?fecha=${sumarDias(fechaElegida, -1)}`}
            aria-label="Día anterior"
            className={`flex h-11 w-11 items-center justify-center rounded-lg border border-borde-control text-tinta-suave transition-colors hover:bg-elevada ${esMinimo ? "pointer-events-none opacity-25" : ""}`}
          >
            ←
          </Link>
          <div className="text-center">
            <p className="text-lg font-medium text-tinta">
              {esHoy ? "Hoy" : esManana ? "Mañana" : formatearFechaAR(fechaElegida)}
            </p>
            {!esHoy && (
              <Link href="/mis-limpiezas" className="text-xs text-tinta-etiqueta hover:text-tinta-suave">
                Volver a hoy
              </Link>
            )}
          </div>
          <Link
            href={`/mis-limpiezas?fecha=${sumarDias(fechaElegida, 1)}`}
            aria-label="Día siguiente"
            className={`flex h-11 w-11 items-center justify-center rounded-lg border border-borde-control text-tinta-suave transition-colors hover:bg-elevada ${esManana ? "pointer-events-none opacity-25" : ""}`}
          >
            →
          </Link>
        </div>
      </div>

      {lista.length === 0 ? (
        <p className="py-12 text-center text-tinta-etiqueta">
          {esHoy
            ? "No tenés limpiezas para hoy."
            : esManana
              ? "No tenés limpiezas para mañana."
              : "No tenías limpiezas ese día."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.map((l, i) => (
            <li key={l.id}>
              <Link
                href={`/mis-limpiezas/${l.id}`}
                className="flex flex-col gap-2 rounded-xl border border-borde bg-superficie p-4 transition-colors hover:bg-elevada/70"
              >
                <div>
                  <p className="text-base font-semibold text-tinta">{l.depto?.codigo}</p>
                  <p className="text-sm text-tinta-tenue">
                    {l.depto?.barrio} · {TIPOS_LIMPIEZA[l.tipo] ?? l.tipo}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tono={TONO_LIMPIEZA[l.estado as EstadoLimpieza] ?? TONO_LIMPIEZA.pendiente}>
                    {ETIQUETA_ESTADO[l.estado] ?? l.estado}
                  </Badge>
                  {(l.reserva?.noches ?? 0) >= 10 && (
                    <span className="rounded-full bg-aviso-soft px-2.5 py-0.5 text-xs font-medium text-aviso-text">
                      {l.reserva!.noches} noches
                    </span>
                  )}
                  <span className="rounded-full bg-elevada px-2.5 py-0.5 text-xs font-medium text-tinta-tenue">
                    {diasSin[i] ? `${diasSinLimpiar(diasSin[i]!.fecha, fechaElegida)} días sin limpiarse` : "sin limpiezas previas"}
                  </span>
                </div>
                <InteraccionHuespedes interaccion={interacciones.get(l.id)!} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
