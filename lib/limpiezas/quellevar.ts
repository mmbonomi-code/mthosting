/**
 * "Qué llevar" (spec Fase 2 §2.4): no es texto libre, son cantidades
 * derivadas del inventario real del departamento. Un juego de sábanas por
 * cama (discriminado por tipo), un juego de toallas por huésped posible, un
 * pie de baño por baño.
 */

export type ItemALlevar = { item: string; cantidad: number };

export function calcularQueLlevar({
  camasKing,
  camasQueen,
  camasTwin,
  capacidad,
  cantidadBanos,
}: {
  camasKing: number;
  camasQueen: number;
  camasTwin: number;
  capacidad: number | null;
  cantidadBanos: number;
}): ItemALlevar[] {
  const items: ItemALlevar[] = [];
  if (camasKing > 0) items.push({ item: "Juego de sábanas king", cantidad: camasKing });
  if (camasQueen > 0) items.push({ item: "Juego de sábanas queen", cantidad: camasQueen });
  if (camasTwin > 0) items.push({ item: "Juego de sábanas individual", cantidad: camasTwin });
  if (capacidad && capacidad > 0) {
    items.push({ item: "Juegos de toalla", cantidad: capacidad });
  }
  if (cantidadBanos > 0) {
    items.push({ item: "Pie de baño", cantidad: cantidadBanos });
  }
  return items;
}
