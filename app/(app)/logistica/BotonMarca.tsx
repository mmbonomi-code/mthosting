"use client";

import { useState, useTransition } from "react";
import type { Resultado } from "./acciones";

/**
 * Un botón chico que se marca y se desmarca con un toque: "Blanco",
 * "Sucio", "Llevar"… Va al costado de la fila, para que en el celular
 * entren muchos departamentos por pantalla (pedido del dueño, 19/10/2026).
 *
 * Pendiente: borde y punto ámbar. Hecho: verde, con ✓ y la hora. Sin
 * confirmaciones: volver a tocarlo lo desmarca, porque en la calle cada
 * toque de más cuesta, y desmarcar ropa o una cuna no pierde nada.
 *
 * Nunca baja de 44px de alto: se toca con el dedo.
 */
export default function BotonMarca({
  hecha,
  texto,
  textoHecha,
  hora,
  bloqueada,
  motivoBloqueo,
  alMarcar,
}: {
  hecha: boolean;
  texto: string;
  /** Lo que dice ya marcado si no hay hora: "Entregada". */
  textoHecha?: string;
  hora?: string | null;
  bloqueada?: boolean;
  motivoBloqueo?: string;
  alMarcar: (valor: boolean) => Promise<Resultado>;
}) {
  const [enviando, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Se muestra el cambio al instante; si la base lo rechaza, vuelve atrás.
  const [optimista, setOptimista] = useState<boolean | null>(null);
  const marcada = optimista ?? hecha;

  const tocar = () => {
    const valor = !marcada;
    setOptimista(valor);
    iniciar(async () => {
      setError(null);
      let r: Resultado;
      try {
        r = await alMarcar(valor);
      } catch {
        r = { error: "Sin señal: no se guardó." };
      }
      if (r?.error) setError(r.error);
      setOptimista(null);
    });
  };

  return (
    <div className="flex flex-col items-stretch">
      <button
        type="button"
        onClick={tocar}
        disabled={enviando || (bloqueada && !marcada)}
        title={bloqueada && !marcada ? motivoBloqueo : marcada ? "Tocá para desmarcar" : undefined}
        aria-pressed={marcada}
        className={`flex h-11 min-w-[4.75rem] items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
          marcada
            ? "bg-exito-soft text-exito-text"
            : "border border-borde-control text-tinta-suave hover:bg-elevada"
        }`}
      >
        {marcada ? (
          // Sigue diciendo QUÉ es: dos botones con "✓ 09:06" no se distinguen.
          <span className="flex flex-col items-center leading-tight">
            <span className="text-[11px] font-normal">{textoHecha ?? texto}</span>
            <span>✓ {hora ?? ""}</span>
          </span>
        ) : (
          <>
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-aviso" />
            {texto}
          </>
        )}
      </button>
      {error && <p className="mt-1 max-w-32 text-xs text-error-text">{error}</p>}
    </div>
  );
}
