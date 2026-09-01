/**
 * El logo de MTHosting (docs/IDENTIDAD-VISUAL.md §4).
 *
 * El isotipo "Barras" es un monograma MT: la barra de arriba es el travesaño
 * de la T, la columna del medio su asta, y las dos cortas de los costados
 * cierran los pies de la M. De reojo también lee como un gráfico de ocupación.
 *
 * Va embebido y no como `<img src="...svg">` por una razón concreta: el
 * logotipo horizontal lleva el nombre como texto, y un SVG cargado desde una
 * dirección se dibuja aislado, sin acceso a las tipografías de la página. Así
 * el nombre saldría en la fuente que hubiera, no en IBM Plex.
 *
 * Reglas que no se tocan: no rotar, no estirar, no sombrear, no cambiar los
 * colores. El ámbar vive solo acá adentro — en la interfaz no se usa nunca.
 */

/** En monocromo las tres columnas quedan del mismo color. Es lo esperado. */
export type TonoLogo = "color" | "negro" | "blanco";

const TINTA: Record<TonoLogo, string> = {
  color: "#FFFFFF",
  negro: "#1A1815",
  blanco: "#FFFFFF",
};

function Barras({ tono }: { tono: TonoLogo }) {
  const tinta = TINTA[tono];
  return (
    <>
      {tono === "color" && <rect width="32" height="32" rx="7" fill="#14532D" />}
      <rect x="5" y="5.5" width="22" height="4" rx="0.5" fill={tinta} />
      <rect x="5" y="19" width="4.6" height="8" rx="0.5" fill={tinta} />
      <rect x="13.7" y="12" width="4.6" height="15" rx="0.5" fill={tinta} />
      <rect
        x="22.4"
        y="19"
        width="4.6"
        height="8"
        rx="0.5"
        fill={tono === "color" ? "#E8A33D" : tinta}
      />
    </>
  );
}

/** Solo el isotipo. Mínimo 16px. */
export function Isotipo({
  alto = 32,
  tono = "color",
  className,
  decorativo = false,
}: {
  alto?: number;
  tono?: TonoLogo;
  className?: string;
  /**
   * Cuando al lado ya está escrito "MTHosting", el isotipo no aporta nada a
   * quien usa lector de pantalla: repetirlo hace que lo lea dos veces. Así se
   * oculta del árbol de accesibilidad sin sacarlo de la pantalla.
   */
  decorativo?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={alto}
      height={alto}
      role={decorativo ? undefined : "img"}
      aria-label={decorativo ? undefined : "MTHosting"}
      aria-hidden={decorativo || undefined}
      className={className}
    >
      <Barras tono={tono} />
    </svg>
  );
}

/** Isotipo + nombre. Mínimo 120px de ancho. */
export function LogoHorizontal({
  alto = 32,
  tono = "color",
  className,
}: {
  alto?: number;
  tono?: TonoLogo;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 158 32"
      width={(alto * 158) / 32}
      height={alto}
      role="img"
      aria-label="MTHosting"
      className={className}
    >
      <Barras tono={tono} />
      <text
        x="41"
        y="22.4"
        // La familia sale de la variable de next/font: el nombre real de la
        // fuente lo genera el build y no se puede escribir a mano.
        fontFamily="var(--font-plex-sans), sans-serif"
        fontSize="20"
        fontWeight="600"
        letterSpacing="-0.35"
        fill={tono === "blanco" ? "#FFFFFF" : "#1A1815"}
      >
        MTHosting
      </text>
    </svg>
  );
}
