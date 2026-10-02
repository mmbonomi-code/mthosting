"use client";

import { estadoTrasMarcar, TEXTO_ACCION, type AccionEquipamiento } from "@/lib/logistica/tareas";
import { marcarEquipamiento, marcarRopa } from "./acciones";
import Tarea from "./Tarea";

/** "Dejé lo blanco" / "Saqué lo sucio" de una limpieza. */
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
    <Tarea
      hecha={hora !== null}
      textoPendiente={que === "blanco" ? "Dejé lo blanco" : "Saqué lo sucio"}
      textoHecha={que === "blanco" ? "Blanco entregado" : "Sucio retirado"}
      detalleHecha={hora}
      alMarcar={(valor) => marcarRopa(limpiezaId, que, valor)}
    />
  );
}

/** Llevar o retirar una cuna, silla o bañadera. */
export function MarcaEquipamiento({
  id,
  accion,
  nombre,
  hecha,
  bloqueada,
}: {
  id: string;
  accion: AccionEquipamiento;
  /** "cuna", "silla de comer"… en minúscula, para armar la frase. */
  nombre: string;
  hecha: boolean;
  bloqueada: boolean;
}) {
  const textos = TEXTO_ACCION[accion];
  return (
    <Tarea
      hecha={hecha}
      textoPendiente={`${textos.pendiente} ${nombre}`}
      textoHecha={textos.hecha}
      bloqueada={bloqueada}
      motivoBloqueo="Primero hay que llevarla."
      alMarcar={(valor) => marcarEquipamiento(id, estadoTrasMarcar(accion, valor))}
    />
  );
}
