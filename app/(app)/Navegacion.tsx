"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { TONO_ALARMA } from "@/lib/estados";

export type ItemMenu = { href: string; texto: string; pendientes: number };

/**
 * La barra de secciones.
 *
 * Es cliente por una sola razón: marcar dónde estás parado. El layout arma la
 * lista —incluido el filtro por rol, que es una decisión de servidor y no
 * puede viajar acá— y esto solo la dibuja.
 *
 * El handoff (§8.1) pide un menú lateral de 240px. Este proyecto todavía usa
 * una barra horizontal arriba; lo que se toma de ahí es la vestimenta del ítem
 * activo, no la forma del menú. Reordenar la navegación en desplegables es
 * otro trabajo, aparte de la identidad.
 */
export default function Navegacion({ items }: { items: ItemMenu[] }) {
  const ruta = usePathname();

  /** Inicio solo cuando es exactamente inicio: si no, se enciende siempre. */
  const estaActivo = (href: string) =>
    href === "/" ? ruta === "/" : ruta === href || ruta.startsWith(`${href}/`);

  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 sm:px-4">
      {items.map((item) => {
        const activo = estaActivo(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activo ? "page" : undefined}
            // 44px en el celular; en escritorio puede bajar a 36.
            className={`flex min-h-11 items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-medium transition-colors sm:min-h-9 ${
              activo
                ? "bg-primary-soft text-primary-soft-text"
                : "text-tinta-suave hover:bg-superficie-hover hover:text-tinta"
            }`}
          >
            {item.texto}
            {/* Cuántas cosas hay que mirar sin entrar. Es la misma alarma que
                en las pantallas, así que usa el mismo tono. */}
            {item.pendientes > 0 && (
              <span
                className={`rounded-full px-1.5 text-xs tabular-nums ${TONO_ALARMA.clases}`}
              >
                {item.pendientes}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
