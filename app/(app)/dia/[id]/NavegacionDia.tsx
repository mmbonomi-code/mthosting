import Link from "next/link";
import { clsBoton } from "@/lib/ui";

/**
 * Anterior · "Llegada 3 de 8" · Siguiente, arriba de la ficha.
 *
 * Para recorrer el día sin volver a la lista después de cada reserva. El
 * orden es el mismo de la lista: primero las llegadas, después las salidas.
 * El centro vuelve al día.
 */
export default function NavegacionDia({
  fecha,
  tipo,
  posicion,
}: {
  /** El día operativo: la fecha de Airbnb, que es donde figura en la lista. */
  fecha: string;
  tipo: "checkin" | "checkout";
  posicion: {
    anterior: string | null;
    siguiente: string | null;
    numero: number;
    total: number;
  } | null;
}) {
  const urlDia = `/dia?fecha=${fecha}`;

  // No figura en la lista de ese día (una salida cancelada, por ejemplo):
  // no hay por dónde avanzar, solo volver.
  if (!posicion) {
    return (
      <Link href={urlDia} className="text-sm text-tinta-tenue hover:text-tinta">
        ← Volver al día
      </Link>
    );
  }

  return (
    <nav aria-label="Recorrer el día" className="flex items-center gap-2">
      <Flecha id={posicion.anterior} texto="‹ Anterior" etiqueta="Movimiento anterior del día" />
      <Link
        href={urlDia}
        className="flex h-11 flex-1 items-center justify-center rounded-lg text-sm text-tinta-tenue hover:bg-elevada hover:text-tinta sm:h-9"
      >
        <span className="tabular-nums">
          {tipo === "checkin" ? "Llegada" : "Salida"} {posicion.numero} de {posicion.total}
        </span>
        <span className="ml-1.5 hidden sm:inline">· volver al día</span>
      </Link>
      <Flecha id={posicion.siguiente} texto="Siguiente ›" etiqueta="Movimiento siguiente del día" />
    </nav>
  );
}

function Flecha({ id, texto, etiqueta }: { id: string | null; texto: string; etiqueta: string }) {
  if (!id) {
    // En la punta de la lista: se ve apagada, igual que un botón deshabilitado.
    return (
      <span
        aria-disabled="true"
        className={`${clsBoton("secundario", "chico")} pointer-events-none shrink-0 opacity-45`}
      >
        {texto}
      </span>
    );
  }
  return (
    <Link
      href={`/dia/${id}`}
      aria-label={etiqueta}
      className={`${clsBoton("secundario", "chico")} shrink-0`}
    >
      {texto}
    </Link>
  );
}
