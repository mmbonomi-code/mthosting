/**
 * La lista de reclamos: los KPIs de arriba y el filtrado
 * (docs/FASE-1-RECLAMOS-ESPECIFICACION.md §5.1).
 *
 * Todo lo que decide qué se cuenta y qué se muestra está acá, para poder
 * probarlo sin base de datos y sin pantalla.
 */

import { diaARDe, mesDe } from "../fechas";
import { requiereAtencion, semaforoDeReclamo, type EstadoReclamo, type Semaforo } from "./plazos";

export type ReclamoEnLista = {
  id: string;
  estado: EstadoReclamo;
  categoria: string;
  motivo: string | null;
  monto_reclamado: number | null;
  monto_cobrado: number | null;
  moneda: string;
  url_airbnb: string | null;
  resuelto_at: string | null;
  codigo_reserva: string;
  huesped_nombre: string | null;
  fecha_checkout: string | null;
  depto_id: string | null;
  depto_codigo: string | null;
};

export type ReclamoConPlazo = ReclamoEnLista & {
  semaforo: Semaforo;
  limite: string | null;
  dias: number | null;
};

/** El foco que aplican los KPIs al tocarlos. */
export type Foco = "urgente" | "sin_presentar" | "esperando" | "cobrado" | null;

export type Filtros = {
  q: string;
  estado: string;
  depto: string;
  foco: Foco;
};

/** Estados donde todavía no se subió nada a Airbnb. */
const SIN_PRESENTAR: ReadonlySet<EstadoReclamo> = new Set(["borrador", "por_presentar"]);

/** Ya está en manos de Airbnb: se espera respuesta. */
const ESPERANDO: ReadonlySet<EstadoReclamo> = new Set(["presentado", "escalado"]);

/** Le agrega a cada reclamo su plazo vigente y su color. */
export function conPlazos(reclamos: ReclamoEnLista[], hoy: string): ReclamoConPlazo[] {
  return reclamos.map((r) => ({
    ...r,
    ...semaforoDeReclamo(r.fecha_checkout, r.estado, hoy),
  }));
}

/**
 * Del más urgente al menos. Dentro del mismo color, primero el que vence
 * antes; los que no tienen plazo van al fondo.
 */
export function ordenarPorUrgencia(reclamos: ReclamoConPlazo[]): ReclamoConPlazo[] {
  const peso: Record<Semaforo, number> = {
    vencido: 0,
    urgente: 1,
    proximo: 2,
    tranquilo: 3,
    sin_plazo: 4,
  };
  return [...reclamos].sort(
    (a, b) =>
      peso[a.semaforo] - peso[b.semaforo] ||
      (a.dias ?? 99_999) - (b.dias ?? 99_999) ||
      (a.depto_codigo ?? "").localeCompare(b.depto_codigo ?? ""),
  );
}

export type Kpis = {
  urgentes: number;
  sin_presentar: number;
  esperando: number;
  cobrado_mes: number;
};

/**
 * Los cuatro números de arriba. "Cobrado (mes)" suma lo efectivamente
 * cobrado en el mes corriente, mirando el día de Buenos Aires en el que se
 * resolvió, no la hora UTC.
 */
export function calcularKpis(reclamos: ReclamoConPlazo[], hoy: string): Kpis {
  const mes = mesDe(hoy);
  return {
    urgentes: reclamos.filter((r) => requiereAtencion(r.semaforo)).length,
    sin_presentar: reclamos.filter((r) => SIN_PRESENTAR.has(r.estado)).length,
    esperando: reclamos.filter((r) => ESPERANDO.has(r.estado)).length,
    cobrado_mes: reclamos
      .filter((r) => {
        if (r.estado !== "cobrado") return false;
        const dia = diaARDe(r.resuelto_at);
        return dia !== null && mesDe(dia) === mes;
      })
      .reduce((suma, r) => suma + (r.monto_cobrado ?? 0), 0),
  };
}

/** El texto libre busca donde uno lo buscaría: código, huésped, depto, motivo. */
function coincideTexto(r: ReclamoConPlazo, q: string): boolean {
  const termino = q.trim().toLowerCase();
  if (termino === "") return true;
  return [r.codigo_reserva, r.huesped_nombre, r.depto_codigo, r.motivo]
    .filter(Boolean)
    .some((campo) => campo!.toLowerCase().includes(termino));
}

export function filtrar(reclamos: ReclamoConPlazo[], filtros: Filtros): ReclamoConPlazo[] {
  return reclamos.filter((r) => {
    if (!coincideTexto(r, filtros.q)) return false;
    if (filtros.estado !== "" && r.estado !== filtros.estado) return false;
    if (filtros.depto !== "" && r.depto_id !== filtros.depto) return false;

    switch (filtros.foco) {
      case "urgente":
        return requiereAtencion(r.semaforo);
      case "sin_presentar":
        return SIN_PRESENTAR.has(r.estado);
      case "esperando":
        return ESPERANDO.has(r.estado);
      case "cobrado":
        return r.estado === "cobrado";
      default:
        return true;
    }
  });
}

/** Montos como se leen acá: `US$ 1.420,50`. */
export function formatearMonto(monto: number | null, moneda = "USD"): string {
  if (monto === null) return "—";
  const simbolo = moneda === "USD" ? "US$" : `${moneda} `;
  return `${simbolo} ${monto.toLocaleString("es-AR", {
    minimumFractionDigits: monto % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}
