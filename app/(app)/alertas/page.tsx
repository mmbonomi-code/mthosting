import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerAlertas } from "@/lib/alertas/permisos";
import { calcularPanelAlertas } from "@/lib/alertas/consultar";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import { formatearHora } from "@/lib/limpiezas/etiquetas";
import SinPermiso from "@/app/componentes/SinPermiso";
import { crearReclamo } from "@/app/(app)/reclamos/acciones";
import { marcarRevisada, resolverConflicto, revisarArreglos } from "./acciones";

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
  searchParams: Promise<{ ocultarVacias?: string }>;
}) {
  const { ocultarVacias } = await searchParams;
  const ocultar = ocultarVacias === "1";
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
          href={ocultar ? "/alertas" : "/alertas?ocultarVacias=1"}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:bg-slate-800"
        >
          {ocultar ? "Mostrar las que están en cero" : "Ocultar las que están en cero"}
        </Link>
      </div>

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
      </div>
    </main>
  );
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
    <div className="flex items-start gap-2 rounded-lg bg-slate-900/40 transition-colors hover:bg-slate-900/70">
      <Link href={href} className="flex min-w-0 flex-1 flex-col gap-0.5 px-3 py-2">
        <FilaTitulo>{titulo}</FilaTitulo>
        <FilaSub>{sub}</FilaSub>
      </Link>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5 p-2">{children}</div>
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
