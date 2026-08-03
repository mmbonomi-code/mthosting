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
  if (!ssid && !pass) return <span className="text-slate-500">—</span>;

  const paraCopiar = `RED: ${ssid ?? "—"} - CLAVE: ${pass ?? "—"}`;

  return (
    <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span>
        <span className="text-xs uppercase tracking-wide text-slate-500">Red </span>
        <span className="text-slate-200">{ssid ?? "—"}</span>
      </span>
      <span>
        <span className="text-xs uppercase tracking-wide text-slate-500">Clave </span>
        <span className="font-mono text-slate-200">{pass ?? "—"}</span>
      </span>
      {velocidad && <span className="text-sm text-slate-500">{velocidad}</span>}
      <BotonCopiar texto={paraCopiar} />
    </span>
  );
}
