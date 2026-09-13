"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { EstadoSync } from "./acciones";
import { clsBotonPrimario } from "@/lib/ui";

function Contador({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-lg border border-slate-800 px-4 py-3">
      <div className="text-2xl font-semibold text-white">{valor}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</div>
    </div>
  );
}

export default function BotonSincronizar({
  accion,
  etiqueta = "Sincronizar ahora",
}: {
  accion: (estadoPrevio: EstadoSync) => Promise<EstadoSync>;
  etiqueta?: string;
}) {
  const [estado, ejecutar, pendiente] = useActionState<EstadoSync>(accion, null);

  return (
    <form action={ejecutar} className="flex flex-col gap-4">
      <div>
        <button type="submit" disabled={pendiente} className={clsBotonPrimario}>
          {pendiente ? "Leyendo calendarios…" : etiqueta}
        </button>
      </div>

      {estado?.resultado === "error" && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-300">
          {estado.error}
        </p>
      )}

      {estado?.resultado === "ok" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Contador etiqueta="Calendarios" valor={estado.resumen.departamentos} />
            <Contador etiqueta="Reservas nuevas" valor={estado.resumen.reservasNuevas} />
            <Contador etiqueta="Ya conocidas" valor={estado.resumen.reservasExistentes} />
            <Contador etiqueta="Bloqueos nuevos" valor={estado.resumen.bloqueosNuevos} />
            <Contador etiqueta="Limpiezas" valor={estado.resumen.limpiezasGeneradas} />
          </div>

          {/* Lo que cambió en Airbnb: queda marcado para confirmar en Alertas. */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Contador etiqueta="¿Canceladas?" valor={estado.resumen.posiblesCancelaciones} />
            <Contador etiqueta="¿Otras fechas?" valor={estado.resumen.cambiosFechas} />
            <Contador etiqueta="¿Otro depto?" valor={estado.resumen.cambiosDepto} />
            <Contador etiqueta="Volvieron a coincidir" valor={estado.resumen.resueltasSolas} />
          </div>
          {estado.resumen.posiblesCancelaciones +
            estado.resumen.cambiosFechas +
            estado.resumen.cambiosDepto >
            0 && (
            <Link href="/alertas" className="text-sm text-slate-300 underline hover:text-white">
              Revisarlas en Alertas →
            </Link>
          )}

          {estado.resumen.avisos.length > 0 && (
            <div className="rounded-xl border border-amber-900 bg-amber-950/40 px-4 py-3">
              <h3 className="text-sm font-semibold text-amber-300">
                Avisos ({estado.resumen.avisos.length})
              </h3>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-amber-200/80">
                {estado.resumen.avisos.map((a, i) => (
                  <li key={i}>• {a}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}
