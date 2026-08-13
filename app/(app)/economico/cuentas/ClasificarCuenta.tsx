"use client";

import { useState, useTransition } from "react";
import { clasificarCuenta } from "../acciones";

type Clasificacion = "mth" | "propietario" | "sin_clasificar";

const OPCIONES: { valor: Clasificacion; texto: string; activo: string }[] = [
  { valor: "mth", texto: "De MTHosting", activo: "border-emerald-500 bg-emerald-950/40 text-emerald-200" },
  { valor: "propietario", texto: "Del propietario", activo: "border-sky-500 bg-sky-950/40 text-sky-200" },
  { valor: "sin_clasificar", texto: "Sin decidir", activo: "border-amber-500 bg-amber-950/40 text-amber-200" },
];

export default function ClasificarCuenta({
  cuentaId,
  actual,
}: {
  cuentaId: string;
  actual: Clasificacion;
}) {
  const [valor, setValor] = useState(actual);
  const [pendiente, comenzar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1.5">
        {OPCIONES.map((o) => (
          <button
            key={o.valor}
            type="button"
            disabled={pendiente}
            onClick={() => {
              const previo = valor;
              setValor(o.valor);
              setError(null);
              comenzar(async () => {
                try {
                  await clasificarCuenta(cuentaId, o.valor);
                } catch (e) {
                  setValor(previo);
                  setError(e instanceof Error ? e.message : "No se pudo guardar.");
                }
              });
            }}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-60 ${
              valor === o.valor
                ? o.activo
                : "border-slate-700 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
