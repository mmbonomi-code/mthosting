"use client";

import { useState } from "react";

/** Botón chico que copia un texto al portapapeles (ej.: contraseña del wifi). */
export default function BotonCopiar({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(texto);
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      }}
      className="rounded-md border border-borde-control px-2 py-1 text-xs font-medium text-tinta-suave transition-colors hover:bg-warm-100"
    >
      {copiado ? "✓ Copiado" : "Copiar"}
    </button>
  );
}
