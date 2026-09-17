import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerAlertas } from "@/lib/alertas/permisos";
import { calcularPanelAlertas, contarCriticas, contarResto } from "@/lib/alertas/consultar";
import type { FilaCambioCalendario } from "@/lib/alertas/calendario";
import { ETIQUETA_CAMBIO_CALENDARIO, TONO_CAMBIO_CALENDARIO } from "@/lib/estados";
import { diaARDe, formatearFechaAR, hoyAR } from "@/lib/fechas";
import { formatearHora } from "@/lib/limpiezas/etiquetas";
import SinPermiso from "@/app/componentes/SinPermiso";
import { crearReclamo } from "@/app/(app)/reclamos/acciones";
import {
  confirmarCambioCalendario,
  descartarCambioCalendario,
  marcarRetenidas,
  marcarRevisada,
  resolverConflicto,
  revisarArreglos,
} from "./acciones";
import AccionesCambio from "./AccionesCambio";

const TEXTO_TIPO_LIMPIEZA: Record<string, string> = {
  normal: "Limpieza",
  repaso: "Repaso",
  cambio_blancos: "Cambio de blancos",
  con_huespedes: "Con huéspedes",
  desmantelar: "Desmantelar",
  propietario: "Del propietario",
};

/**
 * El panel de alertas (spec §3.6): siete listas, en el orden que fija la
 * spec, 0 y 0.b siempre primero y en rojo porque son las únicas donde
 * alguien puede golpear la puerta de un huésped que está adentro.
 */
export default async function Alertas({
  searchParams,
}: {
  searchParams: Promise<{ verTodas?: string }>;
}) {
  const { verTodas } = await searchParams;
  // Por defecto se ven solo las que tienen algo (decisión del dueño,
  // 17/09/2026): las que están en cero son ruido para el uso diario.
  const ocultar = verTodas !== "1";
  const hoy = hoyAR();

  const supabase = await crearClienteServidor();

  if (!(await puedeVerAlertas(supabase))) {
    return (
      <SinPermiso
        titulo="Alertas"
        motivo="El panel de alertas lo ven administración, manager y coordinación."
      />
    );
  }

  const [panel, { data: departamentos }] = await Promise.all([
    calcularPanelAlertas(supabase),
    supabase.from("departamentos").select("id, codigo, barrio").eq("activo", true),
  ]);

  const deptoPorId = new Map((departamentos ?? []).map((d) => [d.id, d]));
  const nombreDepto = (id: string) => {
    const d = deptoPorId.get(id);
    return d ? `${d.codigo}${d.barrio ? ` — ${d.barrio}` : ""}` : id;
  };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Alertas</h1>
          <p className="text-sm text-slate-500">
            Del {formatearFechaAR(panel.desde)} al {formatearFechaAR(panel.hasta)}, más lo que
            esté en marcha ahora mismo.
          </p>
        </div>
        <Link
          href={ocultar ? "/alertas?verTodas=1" : "/alertas"}
          className="flex h-11 items-center rounded-lg border border-slate-700 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 sm:h-9"
        >
          {ocultar ? "Mostrar las que están en cero" : "Ocultar las que están en cero"}
        </Link>
      </div>

      {ocultar && contarCriticas(panel) + contarResto(panel) === 0 && (
        <p className="py-12 text-center text-slate-500">No hay alertas. Todo en cero.</p>
      )}

      <div className="flex flex-col gap-4">
        <Seccion
          titulo="Limpieza sobre estadía ocupada"
          detalle="El check-out se atrasó y la limpieza no pudo moverse: quedó dentro de una estadía con huéspedes adentro."
          cantidad={panel.estadiaOcupada.length}
          tono="rojo"
          ocultar={ocultar}
        >
          {panel.estadiaOcupada.map((a) => (
            <Fila key={a.limpieza_id} href={`/semana?desde=${a.fecha}`}>
              <FilaTitulo>
                {nombreDepto(a.depto_id)} · {formatearFechaAR(a.fecha)}
              </FilaTitulo>
              <FilaSub>{a.detalle}</FilaSub>
            </Fila>
          ))}
        </Seccion>

        <Seccion
          titulo="Ventana insuficiente"
          detalle="Salida y entrada el mismo día, con una ventana materialmente imposible de limpiar."
          cantidad={panel.ventanaInsuficiente.length}
          tono="rojo"
          ocultar={ocultar}
        >
          {panel.ventanaInsuficiente.map((a, i) => (
            <Fila key={i} href={`/reservas/${a.salida.reserva_id}/editar`}>
              <FilaTitulo>
                {nombreDepto(a.depto_id)} · {formatearFechaAR(a.fecha)}
              </FilaTitulo>
              <FilaSub>
                Sale {a.salida.codigo_reserva} a las {formatearHora(a.salida.hora)}, entra{" "}
                {a.entrada.codigo_reserva} a las {formatearHora(a.entrada.hora)}.
              </FilaSub>
            </Fila>
          ))}
        </Seccion>

        <Seccion
          titulo="Cambios en los calendarios de Airbnb"
          detalle="El calendario ya no muestra la reserva, o la muestra en otro departamento. No se aplica solo: miralo en Airbnb y confirmalo acá. Los cambios de fecha no pasan por acá: se aplican solos al sincronizar."
          cantidad={panel.cambiosCalendario.length}
          tono={panel.cambiosCalendario.some((c) => c.urgente) ? "rojo" : "ambar"}
          ocultar={ocultar}
        >
          {panel.cambiosCalendario.map((c) => (
            <FilaAcciones
              key={c.id}
              href={`/reservas/${c.reserva_id}/editar`}
              titulo={
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>
                    {c.depto_id ? nombreDepto(c.depto_id) : "Sin departamento"} ·{" "}
                    <span className="font-mono">{c.codigo_reserva}</span>
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${TONO_CAMBIO_CALENDARIO[c.tipo].clases}`}
                  >
                    {ETIQUETA_CAMBIO_CALENDARIO[c.tipo]}
                  </span>
                </span>
              }
              sub={detalleCambio(c, nombreDepto)}
            >
              <a
                href={`https://www.airbnb.com/hosting/reservations/details/${c.codigo_reserva}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 items-center rounded-md border border-slate-700 px-3 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 sm:h-9"
              >
                Ver en Airbnb ↗
              </a>
              {c.tipo === "posible_cancelacion" && (
                <AccionesCambio
                  codigo={c.codigo_reserva}
                  confirmar={confirmarCambioCalendario.bind(null, c.id)}
                  etiquetaConfirmar="Confirmar cancelación"
                  terminal
                  descartar={descartarCambioCalendario.bind(null, c.id)}
                  etiquetaDescartar="Sigue en pie"
                />
              )}
              {c.tipo === "cambio_fechas" && (
                <AccionesCambio
                  codigo={c.codigo_reserva}
                  confirmar={confirmarCambioCalendario.bind(null, c.id)}
                  etiquetaConfirmar="Aplicar fechas nuevas"
                  descartar={descartarCambioCalendario.bind(null, c.id)}
                  etiquetaDescartar="Ignorar"
                />
              )}
              {c.tipo === "cambio_depto" && (
                <AccionesCambio
                  codigo={c.codigo_reserva}
                  descartar={descartarCambioCalendario.bind(null, c.id)}
                  etiquetaDescartar="Ya lo revisé"
                />
              )}
            </FilaAcciones>
          ))}
        </Seccion>

        <Seccion
          titulo="Algo para arreglar"
          detalle="Lo que alguien vio roto en un departamento y todavía no se resolvió. Se enciende con la foto o con el texto, lo que llegue primero."
          cantidad={panel.arreglos.length}
          tono="rojo"
          ocultar={ocultar}
        >
          {panel.arreglos.map((a) => (
            <FilaAcciones
              key={a.limpieza_id}
              href={`/limpiezas/${a.limpieza_id}`}
              titulo={`${nombreDepto(a.depto_id)} · ${formatearFechaAR(a.fecha)}`}
              sub={detalleArreglo(a.descripciones, a.fotos)}
            >
              <form action={revisarArreglos.bind(null, a.limpieza_id, a.arreglo_ids, a.firma)}>
                <BotonAlerta>Revisado</BotonAlerta>
              </form>
            </FilaAcciones>
          ))}
        </Seccion>

        <Seccion
          titulo="Dejó mal el huésped"
          detalle="La limpieza fotografió algo roto, manchado o sucio fuera de lo normal. Airbnb da 14 días para reclamar: el botón crea el reclamo y le engancha las fotos."
          cantidad={panel.danioHuesped.length}
          tono="rojo"
          ocultar={ocultar}
        >
          {panel.danioHuesped.map((d) => (
            <FilaAcciones
              key={d.limpieza_id}
              href={`/limpiezas/${d.limpieza_id}`}
              titulo={`${nombreDepto(d.depto_id)} · ${formatearFechaAR(d.fecha)}`}
              sub={
                d.reserva
                  ? `${contarFotos(d.cantidad)} · se le reclama a ${d.reserva.codigo_reserva}`
                  : `${contarFotos(d.cantidad)} · no se pudo identificar a qué reserva reclamarle`
              }
            >
              {d.reserva && (
                <form action={crearReclamo.bind(null, d.reserva.id)}>
                  <BotonAlerta destacado>Crear reclamo</BotonAlerta>
                </form>
              )}
              <form action={marcarRevisada.bind(null, "huesped", d.limpieza_id, d.firma)}>
                <BotonAlerta>No corresponde</BotonAlerta>
              </form>
            </FilaAcciones>
          ))}
        </Seccion>

        <Seccion
          titulo="Se lo olvidó el huésped"
          detalle="Cosas que quedaron en el departamento. El huésped ya se fue: cuanto antes se le avise, mejor."
          cantidad={panel.olvidos.length}
          tono="ambar"
          ocultar={ocultar}
        >
          {panel.olvidos.map((o) => (
            <FilaAcciones
              key={o.limpieza_id}
              href={`/limpiezas/${o.limpieza_id}`}
              titulo={`${nombreDepto(o.depto_id)} · ${formatearFechaAR(o.fecha)}`}
              sub={contarFotos(o.cantidad)}
            >
              <form action={marcarRevisada.bind(null, "olvido", o.limpieza_id, o.firma)}>
                <BotonAlerta>Revisado</BotonAlerta>
              </form>
            </FilaAcciones>
          ))}
        </Seccion>

        <Seccion
          titulo="Falta limpieza"
          detalle="Entre un check-out y el siguiente check-in del departamento no hay ninguna limpieza cargada."
          cantidad={panel.faltaLimpieza.length}
          tono="ambar"
          ocultar={ocultar}
        >
          {panel.faltaLimpieza.map((f) => (
            <Fila key={`${f.reserva_id}-${f.tipo}`} href={`/reservas/${f.reserva_id}/editar`}>
              <FilaTitulo>
                {nombreDepto(f.depto_id)} · {formatearFechaAR(f.fecha)}
              </FilaTitulo>
              <FilaSub>
                {f.codigo_reserva} — falta {f.tipo === "salida" ? "la limpieza de salida" : "el repaso de entrada"}.
              </FilaSub>
            </Fila>
          ))}
        </Seccion>

        <Seccion
          titulo="Sin responsable"
          detalle="Limpiezas de hoy, o ya atrasadas, sin nadie asignado. Las de los días siguientes se reparten desde Limpiezas."
          cantidad={panel.sinResponsable.length}
          tono="ambar"
          ocultar={ocultar}
        >
          {panel.sinResponsable.map((f) => (
            <Fila key={f.id} href={`/semana?desde=${f.fecha}`}>
              <FilaTitulo>
                {nombreDepto(f.depto_id)} · {formatearFechaAR(f.fecha)}
              </FilaTitulo>
              <FilaSub>
                {TEXTO_TIPO_LIMPIEZA[f.tipo] ?? f.tipo} · {f.fecha < hoy ? "atrasada" : "para hoy"}
              </FilaSub>
            </Fila>
          ))}
        </Seccion>

        <Seccion
          titulo="Reservas sin departamento"
          detalle="Anuncios de Airbnb que todavía no se mapearon a un departamento."
          cantidad={panel.sinDepto}
          tono="ambar"
          ocultar={ocultar}
        >
          {panel.sinDepto > 0 && (
            <Fila href="/bandeja">
              <FilaTitulo>Ir a la bandeja de sin asignar ({panel.sinDepto})</FilaTitulo>
            </Fila>
          )}
        </Seccion>

        <Seccion
          titulo="Conflictos de cancelación o cambio de fecha"
          detalle="La limpieza ya está en marcha o terminada, pero la reserva se canceló, se descartó o cambió de fecha por debajo."
          cantidad={panel.conflictos.length}
          tono="ambar"
          ocultar={ocultar}
        >
          {panel.conflictos.map((c) => (
            <FilaAcciones
              key={c.limpieza_id}
              href={`/reservas/${c.reserva_id}/editar`}
              titulo={`${nombreDepto(c.depto_id)} · ${formatearFechaAR(c.fecha_limpieza)}`}
              sub={c.detalle}
            >
              {/* Se guarda QUÉ se revisó: si la reserva vuelve a moverse, el
                  aviso reaparece solo. */}
              <form action={resolverConflicto.bind(null, c.limpieza_id, c.firma)}>
                <BotonAlerta>Ya lo revisé</BotonAlerta>
              </form>
            </FilaAcciones>
          ))}
        </Seccion>

        <Seccion
          titulo="Conflictos de late check-out"
          detalle="Late check-out con otro huésped entrando ese mismo día: el sistema no decide solo."
          cantidad={panel.lateCheckout.length}
          tono="ambar"
          ocultar={ocultar}
        >
          {panel.lateCheckout.map((c, i) => (
            <Fila key={i} href={`/reservas/${c.sale.reserva_id}/editar`}>
              <FilaTitulo>
                {nombreDepto(c.depto_id)} · {formatearFechaAR(c.fecha)}
              </FilaTitulo>
              <FilaSub>
                Sale {c.sale.codigo_reserva}, entra {c.entra.codigo_reserva}.
              </FilaSub>
            </Fila>
          ))}
        </Seccion>

        <Seccion
          titulo="Calendarios con problemas"
          detalle="Lo que la última sincronización no pudo leer o frenó. Mientras esté acá, las cancelaciones de esos departamentos no se detectan."
          cantidad={panel.problemasCalendario.length}
          tono="ambar"
          ocultar={ocultar}
        >
          {panel.problemasCalendario.map((p, i) =>
            p.tipo === "sin_sincronizar" ? (
              <Fila key={i} href="/ical">
                <FilaTitulo>La sincronización de calendarios no está corriendo</FilaTitulo>
                <FilaSub>
                  {p.ultima
                    ? `La última completa fue el ${formatearFechaAR(diaARDe(p.ultima)!)}.`
                    : "Todavía no hay ninguna registrada."}{" "}
                  Tocá &quot;Sincronizar ahora&quot;.
                </FilaSub>
              </Fila>
            ) : p.tipo === "fallido" ? (
              <Fila key={i} href={`/departamentos/${p.depto_id}/editar`}>
                <FilaTitulo>{nombreDepto(p.depto_id)}</FilaTitulo>
                <FilaSub>No se pudo leer su calendario ({p.error}). Revisá el link en la ficha.</FilaSub>
              </Fila>
            ) : (
              <FilaAcciones
                key={i}
                href={`/departamentos/${p.depto_id}`}
                titulo={nombreDepto(p.depto_id)}
                sub={
                  p.motivo === "calendario_vacio"
                    ? `Desaparecieron todas sus reservas futuras a la vez (${p.codigos.join(", ")}). Suele ser el link del calendario, no cancelaciones: no se marcó ninguna.`
                    : `Desapareció más del 20% de las reservas en una sola sincronización, así que no se marcó ninguna. De este departamento: ${p.codigos.join(", ")}.`
                }
              >
                <AccionesCambio
                  codigo=""
                  descartar={marcarRetenidas.bind(null, p.reserva_ids)}
                  etiquetaDescartar="Marcarlas igual"
                />
              </FilaAcciones>
            ),
          )}
        </Seccion>
      </div>
    </main>
  );
}

/** Qué vio el calendario, y a quién hay que avisarle si se confirma. */
function detalleCambio(c: FilaCambioCalendario, nombreDepto: (id: string) => string): string {
  const fechas = (desde: string | null, hasta: string | null) =>
    desde && hasta ? `del ${formatearFechaAR(desde)} al ${formatearFechaAR(hasta)}` : "sin fechas";

  const queVio =
    c.tipo === "posible_cancelacion"
      ? c.origen === "excel"
        ? `Según el Excel de tentativas se canceló en Airbnb, pero el calendario todavía la muestra. Acá figura ${fechas(c.fecha_checkin, c.fecha_checkout)}.`
        : `Ya no está en Airbnb. Acá figura ${fechas(c.fecha_checkin, c.fecha_checkout)}.`
      : c.tipo === "cambio_fechas"
        ? `Airbnb la muestra ${fechas(c.calendario_checkin, c.calendario_checkout)}; acá figura ${fechas(c.fecha_checkin, c.fecha_checkout)}.`
        : `Airbnb la muestra en el calendario de ${c.calendario_depto_id ? nombreDepto(c.calendario_depto_id) : "otro departamento"}. Se corrige desde la ficha de la reserva.`;

  const huesped = c.huesped_nombre ? ` Huésped: ${c.huesped_nombre}.` : "";
  const limpieza = c.limpieza
    ? ` Limpieza del ${formatearFechaAR(c.limpieza.fecha)}: ${
        c.limpieza.responsable ? `asignada a ${c.limpieza.responsable}` : "sin asignar"
      }.`
    : "";

  return queVio + huesped + limpieza;
}

const TONO: Record<"rojo" | "ambar", string> = {
  rojo: "border-l-4 border-l-red-600 bg-red-950/30",
  ambar: "border-l-4 border-l-amber-600 bg-amber-950/20",
};

const TONO_TITULO: Record<"rojo" | "ambar", string> = {
  rojo: "text-red-200",
  ambar: "text-amber-200",
};

const TONO_CANTIDAD: Record<"rojo" | "ambar", string> = {
  rojo: "bg-red-500 text-red-950",
  ambar: "bg-amber-500 text-amber-950",
};

function Seccion({
  titulo,
  detalle,
  cantidad,
  tono,
  ocultar,
  children,
}: {
  titulo: string;
  detalle: string;
  cantidad: number;
  tono: "rojo" | "ambar";
  ocultar: boolean;
  children: React.ReactNode;
}) {
  if (ocultar && cantidad === 0) return null;

  return (
    <section className={`flex flex-col gap-3 rounded-xl p-4 ${TONO[tono]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className={`font-medium ${TONO_TITULO[tono]}`}>{titulo}</h2>
          <p className="text-xs text-slate-400">{detalle}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-semibold tabular-nums ${TONO_CANTIDAD[tono]}`}
        >
          {cantidad}
        </span>
      </div>
      {cantidad > 0 && <div className="flex flex-col gap-1.5">{children}</div>}
    </section>
  );
}

function Fila({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex flex-col gap-0.5 rounded-lg bg-slate-900/40 px-3 py-2 transition-colors hover:bg-slate-900/70"
    >
      {children}
    </Link>
  );
}

function FilaTitulo({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-medium text-slate-100">{children}</span>;
}

function FilaSub({ children }: { children: React.ReactNode }) {
  return <span className="text-xs text-slate-400">{children}</span>;
}

/**
 * Lo que se reportó, en una línea. Si solo hay fotos y nadie escribió nada,
 * lo dice: es la señal de que hay que entrar a mirar para saber qué pasa.
 */
function detalleArreglo(descripciones: string[], fotos: number): string {
  const texto = descripciones.join(" · ");
  if (descripciones.length === 0) return `${contarFotos(fotos)}, sin descripción`;
  return fotos > 0 ? `${texto} · ${contarFotos(fotos)}` : texto;
}

/** "3 fotos" / "1 foto". La cantidad importa: no es lo mismo una que seis. */
function contarFotos(cantidad: number): string {
  return cantidad === 1 ? "1 foto" : `${cantidad} fotos`;
}

/**
 * Fila con botones al costado. No puede ser un `<Fila>`, porque un `<form>`
 * adentro de un `<Link>` no es HTML válido: el link ocupa el texto y los
 * botones van aparte.
 */
function FilaAcciones({
  href,
  titulo,
  sub,
  children,
}: {
  href: string;
  titulo: React.ReactNode;
  sub: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    // En el celular los botones van abajo del texto: al costado lo aplastaban
    // a una palabra por renglón.
    <div className="flex flex-col gap-x-2 rounded-lg bg-slate-900/40 transition-colors hover:bg-slate-900/70 sm:flex-row sm:items-start">
      <Link href={href} className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
        <FilaTitulo>{titulo}</FilaTitulo>
        <FilaSub>{sub}</FilaSub>
      </Link>
      <div className="flex flex-wrap items-start gap-1.5 px-3 pb-2 sm:shrink-0 sm:justify-end sm:p-2">
        {children}
      </div>
    </div>
  );
}

function BotonAlerta({
  children,
  destacado,
}: {
  children: React.ReactNode;
  destacado?: boolean;
}) {
  return (
    <button
      type="submit"
      className={`h-9 rounded-md px-3 text-xs font-medium transition-colors ${
        destacado
          ? "bg-red-500 text-red-950 hover:bg-red-400"
          : "border border-slate-700 text-slate-300 hover:bg-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
