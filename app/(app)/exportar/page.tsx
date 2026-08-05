import { hoyAR, mananaAR, sumarDias } from "@/lib/fechas";
import FormulariosExportar from "./FormulariosExportar";

/**
 * Todo lo que sale del sistema hacia afuera (spec §3.4 y §3.5): el PDF que
 * se manda por WhatsApp y los archivos de contactos.
 */
export default function Exportar() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Exportar
        </h1>
        <p className="text-sm text-slate-400">
          Los archivos se descargan en tu computadora; el envío sigue siendo
          manual.
        </p>
      </div>

      <FormulariosExportar
        manana={mananaAR()}
        hoy={hoyAR()}
        enUnMes={sumarDias(hoyAR(), 30)}
        enUnaSemana={sumarDias(hoyAR(), 6)}
      />
    </main>
  );
}
