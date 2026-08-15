/**
 * La tarjeta de la identidad (docs/IDENTIDAD-VISUAL.md §8.2).
 *
 * Es el envase de la vista de limpiezas en el celular: una columna de
 * tarjetas blancas sobre el fondo crema. Radio de 4px, borde tenue y sombra
 * apenas marcada — la app no lleva sombras fuertes.
 *
 * `filete` es el borde de color al costado: la señal que hace que una fila
 * urgente se vea de lejos sin leerla. Va aparte del estado a propósito, para
 * que una tarjeta no pueda gritar dos cosas distintas a la vez.
 */
export default function Tarjeta({
  children,
  filete,
  fondo,
  className,
}: {
  children: React.ReactNode;
  /** Clase de color del filete, p. ej. "border-l-accent". */
  filete?: string;
  /** Fondo alternativo para la tarjeta que hay que mirar. */
  fondo?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-borde p-4 shadow-sm ${
        fondo ?? "bg-superficie"
      } ${filete ? `border-l-[3px] ${filete}` : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
