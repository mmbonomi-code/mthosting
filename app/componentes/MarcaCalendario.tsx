import Link from "next/link";
import { cambioPendiente, type EstadoCambio, type TipoCambio } from "@/lib/ical/cambios";
import { ETIQUETA_CAMBIO_CALENDARIO, TONO_CAMBIO_CALENDARIO } from "@/lib/estados";

type Cambios = { tipo: TipoCambio; estado: EstadoCambio }[] | null | undefined;

/**
 * La marca de una reserva que el calendario de Airbnb puso en duda y nadie
 * confirmó todavía. Va al lado de "Tentativa" en el día, la semana y la
 * ficha: la limpieza sigue en pie, pero nadie tendría que mandar a alguien
 * sin mirar esto antes.
 */
export default function MarcaCalendario({
  cambios,
  className = "px-2 py-0.5",
}: {
  cambios: Cambios;
  className?: string;
}) {
  const tipo = cambioPendiente(cambios);
  if (!tipo) return null;
  return (
    <span
      title="Lo detectó el calendario de Airbnb. Se confirma desde Alertas."
      className={`rounded-full text-xs font-medium ${className} ${TONO_CAMBIO_CALENDARIO[tipo].clases}`}
    >
      {ETIQUETA_CAMBIO_CALENDARIO[tipo]}
    </span>
  );
}

const EXPLICACION: Record<TipoCambio, string> = {
  posible_cancelacion:
    "Esta reserva ya no aparece en el calendario de Airbnb: puede haberse cancelado.",
  cambio_fechas: "El calendario de Airbnb muestra esta reserva con otras fechas.",
  cambio_depto: "El calendario de Airbnb muestra esta reserva en otro departamento.",
};

/** El mismo aviso, explicado, para la ficha de la reserva. */
export function AvisoCalendario({ cambios }: { cambios: Cambios }) {
  const tipo = cambioPendiente(cambios);
  if (!tipo) return null;
  return (
    <p className={`rounded-lg px-4 py-3 text-sm ${TONO_CAMBIO_CALENDARIO[tipo].clases}`}>
      {EXPLICACION[tipo]} Todavía nadie lo confirmó: miralo en Airbnb y resolvelo desde{" "}
      <Link href="/alertas" className="font-medium underline">
        Alertas
      </Link>
      .
    </p>
  );
}
