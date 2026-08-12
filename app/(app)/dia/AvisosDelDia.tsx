import Link from "next/link";
import { formatearFechaAR } from "@/lib/fechas";
import { vigenteEl, type Nota, type Seccion } from "@/lib/reporte/notas";
import {
  ETIQUETA_TIPO,
  seEntregaEl,
  seRetiraEl,
  type Equipamiento,
  type EstadoEquipamiento,
  type TipoEquipamiento,
} from "@/lib/reporte/equipamiento";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Lo del Reporte que toca ese día, arriba de la lista del día.
 *
 * Es la razón de ser del módulo: un aviso que dice "pintan el 28 y 29" o una
 * cuna pedida para el jueves no sirve de nada guardado en una pantalla que
 * hay que acordarse de abrir. Tiene que estar donde se trabaja.
 */
export default async function AvisosDelDia({ fecha }: { fecha: string }) {
  const supabase = await crearClienteServidor();

  const [{ data: notasCrudas }, { data: equiposCrudos }] = await Promise.all([
    supabase
      .from("notas_reporte")
      .select(
        `id, seccion, titulo, detalle, fecha, fecha_hasta, estado,
         depto:departamentos(id, codigo)`,
      )
      .eq("activo", true)
      .eq("estado", "pendiente")
      .or(`fecha.is.null,fecha.lte.${fecha}`)
      .limit(200),
    supabase
      .from("equipamiento_bebe")
      .select(
        `id, tipo, estado, fecha_desde, fecha_hasta, notas,
         depto:departamentos(id, codigo),
         reserva:reservas(id, codigo_reserva, huesped_nombre)`,
      )
      .eq("activo", true)
      .neq("estado", "retirado")
      .lte("fecha_desde", fecha)
      .gte("fecha_hasta", fecha)
      .limit(200),
  ]);

  type CrudaNota = {
    id: string;
    seccion: string;
    titulo: string;
    detalle: string | null;
    fecha: string | null;
    fecha_hasta: string | null;
    estado: string;
    depto: { id: string; codigo: string } | null;
  };

  const notas: Nota[] = ((notasCrudas ?? []) as unknown as CrudaNota[]).map((n) => ({
    id: n.id,
    seccion: n.seccion as Seccion,
    titulo: n.titulo,
    detalle: n.detalle,
    fecha: n.fecha,
    fecha_hasta: n.fecha_hasta,
    depto_id: n.depto?.id ?? null,
    depto_codigo: n.depto?.codigo ?? null,
    responsable_id: null,
    responsable_nombre: null,
    estado: n.estado as Nota["estado"],
  }));

  // Los anuncios se filtran por vigencia acá, con la misma regla que usa el
  // resto del sistema. Los pendientes del día también entran: si algo vence
  // hoy, hoy hay que verlo.
  const vigentes = notas.filter((n) =>
    n.seccion === "anuncio" ? vigenteEl(n, fecha) : n.fecha === fecha,
  );

  type CrudaEquipo = {
    id: string;
    tipo: string;
    estado: string;
    fecha_desde: string;
    fecha_hasta: string;
    notas: string | null;
    depto: { id: string; codigo: string } | null;
    reserva: { id: string; codigo_reserva: string; huesped_nombre: string | null } | null;
  };

  const equipos: Equipamiento[] = (
    (equiposCrudos ?? []) as unknown as CrudaEquipo[]
  ).map((e) => ({
    id: e.id,
    tipo: e.tipo as TipoEquipamiento,
    reserva_id: e.reserva?.id ?? null,
    codigo_reserva: e.reserva?.codigo_reserva ?? null,
    huesped_nombre: e.reserva?.huesped_nombre ?? null,
    depto_id: e.depto?.id ?? null,
    depto_codigo: e.depto?.codigo ?? null,
    fecha_desde: e.fecha_desde,
    fecha_hasta: e.fecha_hasta,
    estado: e.estado as EstadoEquipamiento,
    notas: e.notas,
  }));

  if (vigentes.length === 0 && equipos.length === 0) return null;

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Para tener en cuenta
        </h2>
        <Link href="/reporte" className="text-xs text-slate-500 hover:text-slate-300">
          Ver el reporte →
        </Link>
      </div>

      <ul className="flex flex-col gap-1.5">
        {vigentes.map((n) => (
          <li key={n.id} className="text-sm">
            <span className="text-slate-200">
              {n.depto_codigo && (
                <span className="font-medium text-emerald-300">{n.depto_codigo} · </span>
              )}
              {n.titulo}
            </span>
            {n.detalle && <span className="text-slate-500"> — {n.detalle}</span>}
            {n.seccion === "pendiente" && (
              <span className="ml-1 text-xs text-amber-300">(vence hoy)</span>
            )}
          </li>
        ))}

        {equipos.map((e) => (
          <li key={e.id} className="text-sm">
            <span className="text-slate-200">
              {e.depto_codigo && (
                <span className="font-medium text-emerald-300">{e.depto_codigo} · </span>
              )}
              {ETIQUETA_TIPO[e.tipo]}
              {e.huesped_nombre && (
                <span className="text-slate-500"> para {e.huesped_nombre}</span>
              )}
            </span>
            {seEntregaEl(e, fecha) ? (
              <span className="ml-1 text-xs text-amber-300">— hay que llevarla hoy</span>
            ) : seRetiraEl(e, fecha) ? (
              <span className="ml-1 text-xs text-amber-300">— hay que retirarla hoy</span>
            ) : (
              <span className="ml-1 text-xs text-slate-500">
                — hasta el {formatearFechaAR(e.fecha_hasta)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
