import { clsTarjeta } from "@/lib/ui";

/**
 * La tarjeta de la identidad: el envase de casi todo en el celular.
 *
 * `filete` es el borde de color al costado: la señal que hace que una fila
 * urgente se vea de lejos sin leerla. Va aparte del estado a propósito, para
 * que una tarjeta no pueda gritar dos cosas distintas a la vez.
 */
export default function Tarjeta({
  children,
  filete,
  className,
}: {
  children: React.ReactNode;
  /** Clase de color del filete, p. ej. "border-l-aviso". */
  filete?: string;
  className?: string;
}) {
  return (
    <div
      className={`${clsTarjeta} p-4 ${filete ? `border-l-4 ${filete}` : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
