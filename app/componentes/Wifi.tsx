import BotonCopiar from "./BotonCopiar";

/**
 * Wifi con la red y la clave bien diferenciadas. El botón copia las dos
 * juntas, que es lo que se le pasa al huésped por WhatsApp.
 */
export default function Wifi({
  ssid,
  pass,
  velocidad,
}: {
  ssid: string | null;
  pass: string | null;
  velocidad?: string | null;
}) {
  if (!ssid && !pass) return <span className="text-tinta-etiqueta">—</span>;

  const paraCopiar = `RED: ${ssid ?? "—"} - CLAVE: ${pass ?? "—"}`;

  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>
        <span className="text-xs uppercase tracking-wide text-tinta-etiqueta">Red </span>
        <span className="text-tinta-media">{ssid ?? "—"}</span>
      </span>
      <span>
        <span className="text-xs uppercase tracking-wide text-tinta-etiqueta">Clave </span>
        <span className="font-mono text-tinta-media">{pass ?? "—"}</span>
      </span>
      {velocidad && <span className="text-sm text-tinta-etiqueta">{velocidad}</span>}
      <BotonCopiar texto={paraCopiar} />
    </span>
  );
}
