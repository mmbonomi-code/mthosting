"use client";

import { useState, useTransition } from "react";
import { clasificarCuenta } from "../acciones";

type Clasificacion = "mth" | "propietario" | "sin_clasificar";

const OPCIONES: { valor: Clasificacion; texto: string; activo: string }[] = [
  { valor: "mth", texto: "De MTHosting", activo: "border-primary bg-primary-soft text-primary-soft-text" },
  { valor: "propietario", texto: "Del propietario", activo: "border-dato bg-dato-soft text-dato-text" },
  { valor: "sin_clasificar", texto: "Sin decidir", activo: "border-accent bg-accent-soft text-accent-soft-text" },
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
                : "border-borde-control text-tinta-suave hover:bg-superficie-alt"
            }`}
          >
            {o.texto}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-error-text">
          {error}
        </p>
      )}
    </div>
  );
}
