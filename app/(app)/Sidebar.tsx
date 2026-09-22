"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cerrarSesion } from "@/app/ingresar/acciones";
import { Isotipo } from "@/app/componentes/Logo";
import { clsBoton } from "@/lib/ui";

export type ItemNav = {
  href: string;
  texto: string;
  pendientes: number;
  criticas?: number;
};

/**
 * Menú lateral fijo (docs/IDENTIDAD-VISUAL.md §8.1): 240px a la izquierda en
 * escritorio, siempre visible. En el celular colapsa a una barra angosta con
 * un botón que abre el mismo menú como panel.
 */
export default function Sidebar({
  items,
  nombre,
  inicio,
}: {
  items: ItemNav[];
  nombre: string;
  inicio: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  // El panel del celular no debería dejar scrollear lo de atrás.
  useEffect(() => {
    if (!abierto) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [abierto]);

  const esActivo = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const listaNav = (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setAbierto(false)}
          className={`flex min-h-11 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            esActivo(item.href)
              ? "bg-elevada text-tinta"
              : "text-tinta-suave hover:bg-superficie-alt hover:text-tinta"
          }`}
        >
          <span className="truncate">{item.texto}</span>
          <span className="flex shrink-0 items-center gap-1">
            {(item.criticas ?? 0) > 0 && (
              <span className="rounded-full bg-error px-1.5 text-xs font-semibold text-tinta-inversa">
                {item.criticas}
              </span>
            )}
            {item.pendientes > 0 && (
              <span className="rounded-full bg-aviso px-1.5 text-xs font-semibold text-tinta-inversa">
                {item.pendientes}
              </span>
            )}
          </span>
        </Link>
      ))}
    </nav>
  );

  const pie = (
    <div className="flex flex-col gap-2 border-t border-borde px-3 py-3">
      <span className="truncate px-1 text-sm text-tinta-tenue">{nombre}</span>
      <form action={cerrarSesion}>
        <button
          type="submit"
          className={`${clsBoton("secundario")} w-full`}
        >
          Salir
        </button>
      </form>
    </div>
  );

  return (
    <>
      {/* Escritorio: fijo, siempre visible */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col self-start border-r border-borde bg-fondo md:flex">
        <Link
          href={inicio}
          className="flex items-center gap-2.5 border-b border-borde px-4 py-4"
        >
          <Isotipo alto={26} decorativo />
          <span className="text-lg font-semibold tracking-tight text-tinta">MTHosting</span>
        </Link>
        {listaNav}
        {pie}
      </aside>

      {/* Celular: barra angosta + botón que abre el mismo menú como panel */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-borde bg-fondo/95 px-4 py-3 backdrop-blur md:hidden">
        <Link href={inicio} className="flex items-center gap-2.5">
          <Isotipo alto={26} decorativo />
          <span className="text-lg font-semibold tracking-tight text-tinta">MTHosting</span>
        </Link>
        <button
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-elevada"
        >
          <span className="text-xl">☰</span>
        </button>
      </header>

      {abierto && (
        <div className="fixed inset-0 z-30 md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="absolute inset-0 bg-fondo-hundido/60"
          />
          <aside className="absolute right-0 top-0 flex h-full w-72 max-w-[85vw] flex-col bg-fondo shadow-xl">
            <div className="flex items-center justify-between border-b border-borde px-4 py-4">
              <span className="text-lg font-semibold tracking-tight text-tinta">Menú</span>
              <button
                type="button"
                onClick={() => setAbierto(false)}
                aria-label="Cerrar menú"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-tinta-suave transition-colors hover:bg-elevada"
              >
                <span className="text-xl">✕</span>
              </button>
            </div>
            {listaNav}
            {pie}
          </aside>
        </div>
      )}
    </>
  );
}
