"use client";

import Link from "next/link";
import { ETIQUETA_AMBIENTES } from "@/lib/etiquetas";
import { clsEntrada } from "@/lib/ui";

export type Filtros = {
  q: string;
  estado: string;
  ambientes: string;
  camas: string;
  huespedes: string;
};

const clsSelect = `${clsEntrada} sm:w-auto`;

export default function FiltrosDepartamentos({
  filtros,
  hayFiltros,
}: {
  filtros: Filtros;
  hayFiltros: boolean;
}) {
  /** Al cambiar un desplegable se aplica el filtro sin tocar ningún botón. */
  const alCambiar = (e: React.ChangeEvent<HTMLSelectElement>) =>
    e.currentTarget.form?.requestSubmit();

  return (
    <form
      action="/departamentos"
      method="get"
      className="flex flex-col gap-2 rounded-md border border-borde bg-superficie p-3"
    >
      <input
        type="search"
        name="q"
        defaultValue={filtros.q}
        placeholder="Buscar por código, nombre, barrio o dirección…"
        className={clsEntrada}
      />

      <div className="flex flex-wrap gap-2">
        <select
          name="estado"
          defaultValue={filtros.estado}
          onChange={alCambiar}
          className={clsSelect}
          aria-label="Estado"
        >
          <option value="">Todos los estados</option>
          <option value="activo">Solo activos</option>
          <option value="suspendido">Solo suspendidos</option>
        </select>

        <select
          name="ambientes"
          defaultValue={filtros.ambientes}
          onChange={alCambiar}
          className={clsSelect}
          aria-label="Ambientes"
        >
          <option value="">Todos los ambientes</option>
          {Object.entries(ETIQUETA_AMBIENTES).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </select>

        <select
          name="camas"
          defaultValue={filtros.camas}
          onChange={alCambiar}
          className={clsSelect}
          aria-label="Cantidad de camas"
        >
          <option value="">Cualquier cantidad de camas</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={String(n)}>
              {n}
              {n === 5 ? "+ camas" : n === 1 ? " cama o más" : " camas o más"}
            </option>
          ))}
        </select>

        <select
          name="huespedes"
          defaultValue={filtros.huespedes}
          onChange={alCambiar}
          className={clsSelect}
          aria-label="Cantidad de huéspedes"
        >
          <option value="">Cualquier cantidad de huéspedes</option>
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={String(n)}>
              {n}
              {n === 6 ? "+ huéspedes" : n === 1 ? " huésped o más" : " huéspedes o más"}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="h-11 rounded-md border border-borde-control px-4 text-sm font-medium text-tinta-suave transition-colors hover:bg-superficie-alt"
        >
          Buscar
        </button>

        {hayFiltros && (
          <Link
            href="/departamentos"
            className="flex h-11 items-center px-3 text-sm text-tinta-suave underline decoration-borde-fuerte underline-offset-4 hover:text-tinta"
          >
            Limpiar
          </Link>
        )}
      </div>
    </form>
  );
}
