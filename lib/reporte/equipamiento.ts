/**
 * Cunas, sillas de comer y bañaderas de bebé.
 *
 * El objetivo es no olvidarse: si un huésped pidió una cuna, tiene que
 * aparecer el día que llega, no en una pantalla que alguien recuerde abrir.
 *
 * Funciones puras, con tests.
 */

export type TipoEquipamiento = "cuna" | "silla" | "banadera";
export type EstadoEquipamiento = "pedido" | "entregado" | "retirado";

export const ETIQUETA_TIPO: Record<TipoEquipamiento, string> = {
  cuna: "Cuna",
  silla: "Silla de comer",
  banadera: "Bañadera",
};

export const ETIQUETA_ESTADO_EQUIPAMIENTO: Record<EstadoEquipamiento, string> = {
  pedido: "Pedido",
  entregado: "Entregado",
  retirado: "Retirado",
};

export const TIPOS: TipoEquipamiento[] = ["cuna", "silla", "banadera"];

export type Equipamiento = {
  id: string;
  tipo: TipoEquipamiento;
  reserva_id: string | null;
  codigo_reserva: string | null;
  huesped_nombre: string | null;
  depto_id: string | null;
  depto_codigo: string | null;
  fecha_desde: string;
  fecha_hasta: string;
  estado: EstadoEquipamiento;
  notas: string | null;
};

/** ¿Está en el departamento ese día? Los dos extremos incluidos. */
export function enUsoEl(e: Equipamiento, dia: string): boolean {
  return e.estado !== "retirado" && dia >= e.fecha_desde && dia <= e.fecha_hasta;
}

/** Lo que hay que llevar ese día: arranca justo ahí. */
export function seEntregaEl(e: Equipamiento, dia: string): boolean {
  return e.estado === "pedido" && e.fecha_desde === dia;
}

/** Lo que hay que retirar ese día. */
export function seRetiraEl(e: Equipamiento, dia: string): boolean {
  return e.estado !== "retirado" && e.fecha_hasta === dia;
}

/**
 * Lo pendiente de hoy en adelante, del más próximo al más lejano. Lo ya
 * retirado no aparece: es historia.
 */
export function proximos(equipos: Equipamiento[], hoy: string): Equipamiento[] {
  return equipos
    .filter((e) => e.estado !== "retirado" && e.fecha_hasta >= hoy)
    .sort(
      (a, b) =>
        a.fecha_desde.localeCompare(b.fecha_desde) ||
        (a.depto_codigo ?? "").localeCompare(b.depto_codigo ?? ""),
    );
}

/** Un renglón como se lee: "Cuna · R. PEÑA 1 · 15/08 al 23/08". */
export function describir(e: Equipamiento): string {
  const donde = e.depto_codigo ?? "Sin departamento";
  return `${ETIQUETA_TIPO[e.tipo]} · ${donde}`;
}

export type FiltrosEquipamiento = {
  tipo: TipoEquipamiento | null;
  verRetirados: boolean;
  q: string;
};

export function filtrarEquipamiento(
  equipos: Equipamiento[],
  filtros: FiltrosEquipamiento,
): Equipamiento[] {
  const termino = filtros.q.trim().toLowerCase();

  return equipos.filter((e) => {
    if (!filtros.verRetirados && e.estado === "retirado") return false;
    if (filtros.tipo !== null && e.tipo !== filtros.tipo) return false;
    if (termino === "") return true;
    return [e.depto_codigo, e.huesped_nombre, e.codigo_reserva, e.notas]
      .filter(Boolean)
      .some((campo) => campo!.toLowerCase().includes(termino));
  });
}
