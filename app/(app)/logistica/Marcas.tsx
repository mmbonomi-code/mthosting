"use client";

import { estadoTrasMarcar, TEXTO_ACCION, type AccionEquipamiento } from "@/lib/logistica/tareas";
import { marcarEquipamiento, marcarRopa } from "./acciones";
import BotonMarca from "./BotonMarca";

/** "Blanco" / "Sucio" de una limpieza: lo dejó, lo sacó. */
export function MarcaRopa({
  limpiezaId,
  que,
  hora,
}: {
  limpiezaId: string;
  que: "blanco" | "sucio";
  /** La hora en que se marcó; null si todavía no. */
  hora: string | null;
}) {
  return (
    <BotonMarca
      hecha={hora !== null}
      texto={que === "blanco" ? "Blanco" : "Sucio"}
      hora={hora}
      alMarcar={(valor) => marcarRopa(limpiezaId, que, valor)}
    />
  );
}

/** Llevar o retirar una cuna, silla o bañadera. */
export function MarcaEquipamiento({
  id,
  accion,
  hecha,
  bloqueada,
}: {
  id: string;
  accion: AccionEquipamiento;
  hecha: boolean;
  bloqueada: boolean;
}) {
  const textos = TEXTO_ACCION[accion];
  return (
    <BotonMarca
      hecha={hecha}
      texto={textos.pendiente}
      textoHecha={textos.hecha}
      bloqueada={bloqueada}
      motivoBloqueo="Primero hay que llevarla."
      alMarcar={(valor) => marcarEquipamiento(id, estadoTrasMarcar(accion, valor))}
    />
  );
}
