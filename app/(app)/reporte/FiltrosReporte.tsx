"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clsEntrada } from "@/lib/ui";

/**
 * Buscador y filtros del reporte. Los filtros van en la dirección, así que
 * una vista filtrada se puede pasar por mensaje y abre igual.
 */
export default function FiltrosReporte({
  seccion,
  q,
  responsable,
  tipo,
  verCerrados,
  responsables,
  tipos,
  etiquetaCerrados,
}: {
  seccion: string;
  q: string;
  responsable: string;
  tipo: string;
  verCerrados: boolean;
  /** Solo para pendientes: quiénes tienen algo asignado. */
  responsables: { id: string; nombre: string }[];
  /** Solo para el equipamiento. */
  tipos: { valor: string; etiqueta: string }[];
  etiquetaCerrados: string;
}) {
  const router = useRouter();
  const [texto, setTexto] = useState(q);

  const url = (cambios: Record<string, string>) => {
    const p = new URLSearchParams();
    const valores: Record<string, string> = {
      seccion,
      q: texto,
      responsable,
      tipo,
      cerrados: verCerrados ? "1" : "",
      ...cambios,
    };
    for (const [clave, valor] of Object.entries(valores)) {
      if (valor) p.set(clave, valor);
    }
    return `/reporte?${p.toString()}`;
  };

  useEffect(() => {
    if (texto === q) return;
    const t = setTimeout(() => router.replace(url({ q: texto })), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Buscar"
          aria-label="Buscar en el reporte"
          className={`${clsEntrada} min-w-48 flex-1`}
        />
        {tipos.length > 0 && (
          <select
            value={tipo}
            onChange={(e) => router.replace(url({ tipo: e.target.value }))}
            aria-label="Filtrar por tipo"
            className={clsEntrada}
          >
            <option value="">Todo</option>
            {tipos.map((t) => (
              <option key={t.valor} value={t.valor}>
                {t.etiqueta}
              </option>
            ))}
          </select>
        )}
        <Link
          href={url({ cerrados: verCerrados ? "" : "1" })}
          className={`flex items-center rounded-md border px-3 py-2 text-sm transition-colors ${
            verCerrados
              ? "border-borde-fuerte bg-superficie-alt text-tinta"
              : "border-borde-control text-tinta-suave hover:bg-superficie-alt"
          }`}
        >
          {etiquetaCerrados}
        </Link>
      </div>

      {/* Lo que antes eran las secciones Logística y Diego: ahora son
          responsables, y la lista se arma sola con quién tiene algo. */}
      {responsables.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Link
            href={url({ responsable: "" })}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              responsable === ""
                ? "bg-warm-100 text-tinta"
                : "text-tinta-suave hover:bg-superficie-alt"
            }`}
          >
            Todos
          </Link>
          {responsables.map((r) => (
            <Link
              key={r.id}
              href={url({ responsable: r.id })}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                responsable === r.id
                  ? "bg-warm-100 text-tinta"
                  : "text-tinta-suave hover:bg-superficie-alt"
              }`}
            >
              {r.nombre}
            </Link>
          ))}
          <Link
            href={url({ responsable: "sin_asignar" })}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              responsable === "sin_asignar"
                ? "bg-warm-100 text-tinta"
                : "text-tinta-suave hover:bg-superficie-alt"
            }`}
          >
            Sin asignar
          </Link>
        </div>
      )}
    </div>
  );
}
