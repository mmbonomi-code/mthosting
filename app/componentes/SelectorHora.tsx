"use client";

import { clsEntrada } from "@/lib/ui";

/**
 * Horario en franjas de 5 minutos (spec §3.1). Es un desplegable y no un
 * campo de hora libre: si el sistema solo acepta múltiplos de 5, no tiene
 * sentido dejar tipear 21:56 para después rechazarlo.
 */
const OPCIONES = Array.from({ length: (24 * 60) / 5 }, (_, i) => {
  const minutos = i * 5;
  const hh = String(Math.floor(minutos / 60)).padStart(2, "0");
  const mm = String(minutos % 60).padStart(2, "0");
  return `${hh}:${mm}`;
});

export default function SelectorHora({
  name,
  defaultValue,
  ancho,
  onChange,
}: {
  name: string;
  defaultValue?: string | null;
  ancho?: string;
  onChange?: (valor: string) => void;
}) {
  // Una hora vieja que no caiga en la grilla se conserva como opción, para
  // no perderla sin avisar.
  const actual = defaultValue?.slice(0, 5) ?? "";
  const opciones = actual && !OPCIONES.includes(actual) ? [actual, ...OPCIONES] : OPCIONES;

  return (
    <select
      name={name}
      defaultValue={actual}
      onChange={(e) => onChange?.(e.target.value)}
      className={`${clsEntrada} ${ancho ?? ""}`}
    >
      <option value="">— Sin hora —</option>
      {opciones.map((hora) => (
        <option key={hora} value={hora}>
          {hora}
        </option>
      ))}
    </select>
  );
}
