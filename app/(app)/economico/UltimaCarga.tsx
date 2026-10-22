import Link from "next/link";
import { textoDeCargas, type UltimasCargas } from "@/lib/economico/cargas";

/**
 * Desde cuándo son los números de la pantalla.
 *
 * Va en Resumen y en Rentabilidad porque las dos muestran plata importada a
 * mano: sin esta línea, un dato de hace dos semanas se lee igual que uno de
 * hoy. El link lleva al historial, que es donde se ve el detalle y se puede
 * deshacer una carga.
 */
export default function UltimaCarga({
  cargas,
  hoy,
  incluirProgramados = true,
}: {
  cargas: UltimasCargas;
  hoy: string;
  incluirProgramados?: boolean;
}) {
  return (
    <p className="text-xs text-tinta-etiqueta">
      {textoDeCargas(cargas, hoy, incluirProgramados)}{" "}
      <Link href="/economico/importaciones" className="underline">
        ver importaciones
      </Link>
    </p>
  );
}
