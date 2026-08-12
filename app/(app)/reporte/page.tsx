import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeEscribirReporte } from "@/lib/reporte/permisos";
import { hoyAR } from "@/lib/fechas";
import {
  contarUrgentes,
  filtrarNotas,
  ordenarPorUrgencia,
  type Nota,
  type Seccion,
} from "@/lib/reporte/notas";
import {
  ETIQUETA_TIPO,
  filtrarEquipamiento,
  proximos,
  TIPOS,
  type Equipamiento,
  type EstadoEquipamiento,
  type TipoEquipamiento,
} from "@/lib/reporte/equipamiento";
import FiltrosReporte from "./FiltrosReporte";
import FilaNota from "./FilaNota";
import FilaEquipamiento from "./FilaEquipamiento";
import NuevaNota from "./NuevaNota";
import NuevoEquipamiento from "./NuevoEquipamiento";
import {
  alternarHecho,
  archivarEquipamiento,
  archivarNota,
  cambiarEstadoEquipamiento,
  crearEquipamiento,
  crearNota,
  editarNota,
} from "./acciones";

type Pestania = "pendiente" | "anuncio" | "equipamiento";

const PESTANIAS: { valor: Pestania; texto: string }[] = [
  { valor: "pendiente", texto: "Pendientes" },
  { valor: "anuncio", texto: "Anuncios" },
  { valor: "equipamiento", texto: "Cunas y sillas" },
];

type FilaNotaCruda = {
  id: string;
  seccion: string;
  titulo: string;
  detalle: string | null;
  fecha: string | null;
  fecha_hasta: string | null;
  estado: string;
  depto: { id: string; codigo: string } | null;
  responsable: { id: string; nombre: string } | null;
};

type FilaEquipoCruda = {
  id: string;
  tipo: string;
  estado: string;
  fecha_desde: string;
  fecha_hasta: string;
  notas: string | null;
  depto: { id: string; codigo: string } | null;
  reserva: { id: string; codigo_reserva: string; huesped_nombre: string | null } | null;
};

export default async function Reporte({
  searchParams,
}: {
  searchParams: Promise<{
    seccion?: string;
    q?: string;
    responsable?: string;
    tipo?: string;
    cerrados?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await crearClienteServidor();
  const hoy = hoyAR();

  const pestania = (
    PESTANIAS.some((p) => p.valor === params.seccion) ? params.seccion : "pendiente"
  ) as Pestania;

  const verCerrados = params.cerrados === "1";
  const q = params.q ?? "";
  const responsable = params.responsable ?? "";
  const tipo = params.tipo ?? "";

  const [
    { data: notasCrudas },
    { data: equiposCrudos },
    { data: departamentos },
    { data: personas },
    puedeEscribir,
  ] = await Promise.all([
    supabase
      .from("notas_reporte")
      .select(
        `id, seccion, titulo, detalle, fecha, fecha_hasta, estado,
         depto:departamentos(id, codigo),
         responsable:personas(id, nombre)`,
      )
      .eq("activo", true)
      .order("fecha", { nullsFirst: false })
      .limit(500),
    supabase
      .from("equipamiento_bebe")
      .select(
        `id, tipo, estado, fecha_desde, fecha_hasta, notas,
         depto:departamentos(id, codigo),
         reserva:reservas(id, codigo_reserva, huesped_nombre)`,
      )
      .eq("activo", true)
      .order("fecha_desde")
      .limit(500),
    supabase
      .from("departamentos")
      .select("id, codigo")
      .eq("estado", "activo")
      .order("codigo"),
    supabase
      .from("personas")
      .select("id, nombre")
      .eq("activo", true)
      .order("nombre"),
    puedeEscribirReporte(supabase),
  ]);

  const notas: Nota[] = ((notasCrudas ?? []) as unknown as FilaNotaCruda[]).map((n) => ({
    id: n.id,
    seccion: n.seccion as Seccion,
    titulo: n.titulo,
    detalle: n.detalle,
    fecha: n.fecha,
    fecha_hasta: n.fecha_hasta,
    depto_id: n.depto?.id ?? null,
    depto_codigo: n.depto?.codigo ?? null,
    responsable_id: n.responsable?.id ?? null,
    responsable_nombre: n.responsable?.nombre ?? null,
    estado: n.estado as Nota["estado"],
  }));

  const equipos: Equipamiento[] = (
    (equiposCrudos ?? []) as unknown as FilaEquipoCruda[]
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

  const pendientes = notas.filter((n) => n.seccion === "pendiente");
  const anuncios = notas.filter((n) => n.seccion === "anuncio");

  const urgentes = contarUrgentes(pendientes, hoy);
  const porLlevar = proximos(equipos, hoy).filter(
    (e) => e.estado === "pedido" && e.fecha_desde <= hoy,
  ).length;

  // Los responsables que aparecen son los que tienen algo asignado: la lista
  // se arma sola y no hay secciones escritas en el código.
  const conAlgo = new Map<string, string>();
  for (const n of pendientes) {
    if (n.responsable_id && n.responsable_nombre) {
      conAlgo.set(n.responsable_id, n.responsable_nombre);
    }
  }
  const responsables = [...conAlgo].map(([id, nombre]) => ({ id, nombre }));

  const notasVisibles = ordenarPorUrgencia(
    filtrarNotas(pestania === "anuncio" ? anuncios : pendientes, {
      responsable: responsable === "" ? null : responsable,
      verHechos: verCerrados,
      q,
    }),
    hoy,
  );

  const equiposVisibles = filtrarEquipamiento(equipos, {
    tipo: tipo === "" ? null : (tipo as TipoEquipamiento),
    verRetirados: verCerrados,
    q,
  }).sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde));

  const enlace = (p: Pestania) => `/reporte?seccion=${p}`;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Reporte</h1>
        <p className="text-sm text-slate-400">
          Lo que el back office se deja asentado. Cada cosa tiene su fecha y se
          marca hecha cuando se resuelve.
        </p>
      </div>

      {(urgentes > 0 || porLlevar > 0) && (
        <p className="rounded-xl bg-red-950/60 px-4 py-3 text-sm text-red-200">
          {urgentes > 0 && (
            <>
              <strong>
                {urgentes} pendiente{urgentes === 1 ? "" : "s"}{" "}
                {urgentes === 1 ? "vencido o vence" : "vencidos o vencen"} hoy.
              </strong>{" "}
            </>
          )}
          {porLlevar > 0 && (
            <span className="text-red-300">
              {porLlevar} {porLlevar === 1 ? "cuna o silla" : "cunas o sillas"} sin
              entregar.
            </span>
          )}
        </p>
      )}

      <nav className="flex gap-1 border-b border-slate-800">
        {PESTANIAS.map((p) => {
          const activa = p.valor === pestania;
          const cuenta =
            p.valor === "pendiente"
              ? pendientes.filter((n) => n.estado === "pendiente").length
              : p.valor === "anuncio"
                ? anuncios.filter((n) => n.estado === "pendiente").length
                : proximos(equipos, hoy).length;
          return (
            <Link
              key={p.valor}
              href={enlace(p.valor)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                activa
                  ? "border-white text-white"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              {p.texto}
              {cuenta > 0 && (
                <span className="ml-1.5 text-xs text-slate-500">{cuenta}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <FiltrosReporte
        seccion={pestania}
        q={q}
        responsable={responsable}
        tipo={tipo}
        verCerrados={verCerrados}
        responsables={pestania === "pendiente" ? responsables : []}
        tipos={
          pestania === "equipamiento"
            ? TIPOS.map((t) => ({ valor: t, etiqueta: ETIQUETA_TIPO[t] }))
            : []
        }
        etiquetaCerrados={
          pestania === "equipamiento" ? "Ver retiradas" : "Ver hechos"
        }
      />

      {puedeEscribir &&
        (pestania === "equipamiento" ? (
          <NuevoEquipamiento
            accion={async (_previo, fd) => {
              "use server";
              return crearEquipamiento(fd);
            }}
            departamentos={departamentos ?? []}
          />
        ) : (
          <NuevaNota
            key={pestania}
            seccion={pestania}
            accion={async (_previo, fd) => {
              "use server";
              return crearNota(pestania, fd);
            }}
            departamentos={departamentos ?? []}
            personas={personas ?? []}
          />
        ))}

      {pestania === "equipamiento" ? (
        equiposVisibles.length === 0 ? (
          <Vacio texto="No hay cunas, sillas ni bañaderas anotadas con estos filtros." />
        ) : (
          <ul className="flex flex-col gap-2">
            {equiposVisibles.map((e) => (
              <FilaEquipamiento
                key={e.id}
                equipo={e}
                hoy={hoy}
                cambiarEstado={cambiarEstadoEquipamiento.bind(null, e.id)}
                archivar={archivarEquipamiento.bind(null, e.id)}
                puedeEscribir={puedeEscribir}
              />
            ))}
          </ul>
        )
      ) : notasVisibles.length === 0 ? (
        <Vacio
          texto={
            pestania === "anuncio"
              ? "No hay avisos con estos filtros."
              : "No hay pendientes con estos filtros."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {notasVisibles.map((n) => (
            <FilaNota
              key={n.id}
              nota={n}
              hoy={hoy}
              editar={async (_previo, fd) => {
                "use server";
                return editarNota(n.id, fd);
              }}
              alternar={async (hecho: boolean) => {
                "use server";
                return alternarHecho(n.id, hecho);
              }}
              archivar={archivarNota.bind(null, n.id)}
              departamentos={departamentos ?? []}
              personas={personas ?? []}
              puedeEscribir={puedeEscribir}
            />
          ))}
        </ul>
      )}

      {!puedeEscribir && (
        <p className="text-xs text-slate-500">
          Podés leer el reporte. Escribirlo es de back office, manager y
          administración.
        </p>
      )}
    </main>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-12 text-center">
      <p className="text-slate-300">{texto}</p>
    </div>
  );
}
