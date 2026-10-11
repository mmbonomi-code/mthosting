import Link from "next/link";
import { clsBoton } from "@/lib/ui";
import type { Periodo } from "@/lib/calidad/periodo";

const ATAJOS = [
  { clave: "90", texto: "Últimos 90 días", href: "?p=90" },
  { clave: "anio", texto: "Este año", href: "?p=anio" },
  { clave: "todo", texto: "Todo", href: "?p=todo" },
] as const;

const clsFecha =
  "h-11 rounded-lg border border-borde-control bg-elevada px-3 text-base text-tinta outline-none focus:border-primary sm:h-9 sm:text-sm";

/**
 * El período de Calidad: tres atajos y un rango libre. Es un formulario
 * común (GET): funciona sin JavaScript y el período queda en la URL, así se
 * puede compartir lo que se está mirando.
 */
export default function SelectorPeriodo({ periodo, ruta }: { periodo: Periodo; ruta: string }) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {ATAJOS.map((a) => (
        <Link
          key={a.clave}
          href={`${ruta}${a.href}`}
          aria-current={periodo.clave === a.clave ? "true" : undefined}
          className={`${clsBoton("secundario", "chico")} ${
            periodo.clave === a.clave ? "border-borde-activo bg-elevada text-tinta" : ""
          }`}
        >
          {a.texto}
        </Link>
      ))}
      <form action={ruta} className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-tinta-etiqueta">Desde</span>
          <input type="date" name="desde" defaultValue={periodo.desde} required className={clsFecha} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-tinta-etiqueta">Hasta</span>
          <input type="date" name="hasta" defaultValue={periodo.hasta} required className={clsFecha} />
        </label>
        <button
          type="submit"
          className={`${clsBoton("secundario", "chico")} ${
            periodo.clave === "rango" ? "border-borde-activo bg-elevada text-tinta" : ""
          }`}
        >
          Ver rango
        </button>
      </form>
    </div>
  );
}
