"use client";

import { useState } from "react";

/**
 * Horario en dos partes: la hora por un lado y los minutos por otro, en
 * saltos de 5 (spec §3.1). Un único desplegable con las 288 combinaciones
 * es imposible de usar; dos cortos se manejan de un toque en el celular.
 *
 * El valor combinado viaja en un campo oculto, así el formulario recibe
 * `hora_coordinada` como siempre.
 */
const HORAS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTOS = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0"));

const clsParte =
  "h-11 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 text-center text-base text-white outline-none focus:border-slate-400";

export default function SelectorHora({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue?: string | null;
  onChange?: (valor: string) => void;
}) {
  const actual = defaultValue?.slice(0, 5) ?? "";
  const [hora, setHora] = useState(actual ? actual.slice(0, 2) : "");
  const [minuto, setMinuto] = useState(actual ? actual.slice(3, 5) : "");

  const valor = hora === "" ? "" : `${hora}:${minuto || "00"}`;

  const cambiar = (nuevaHora: string, nuevoMinuto: string) => {
    setHora(nuevaHora);
    setMinuto(nuevoMinuto);
    onChange?.(nuevaHora === "" ? "" : `${nuevaHora}:${nuevoMinuto || "00"}`);
  };

  // Un minuto viejo fuera de la grilla (por ejemplo 21:56) no se pierde.
  const minutos = minuto && !MINUTOS.includes(minuto) ? [minuto, ...MINUTOS] : MINUTOS;

  return (
    <span className="flex items-center gap-2">
      <input type="hidden" name={name} value={valor} />
      <select
        value={hora}
        onChange={(e) => cambiar(e.target.value, e.target.value === "" ? "" : minuto || "00")}
        aria-label="Hora"
        className={clsParte}
      >
        <option value="">--</option>
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-slate-500">:</span>
      <select
        value={minuto}
        onChange={(e) => cambiar(hora || "00", e.target.value)}
        aria-label="Minutos"
        className={clsParte}
      >
        <option value="">--</option>
        {minutos.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </span>
  );
}
