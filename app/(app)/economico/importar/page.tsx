import FormularioImportar from "./FormularioImportar";

export default function ImportarEconomico() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Importar cobros de Airbnb
        </h1>
        <p className="text-sm text-slate-400">
          Ganancias → Historial de transacciones, exportado a CSV. Se cargan todos
          los archivos juntos y una fila ya cargada no se vuelve a tomar.
        </p>
      </div>

      <FormularioImportar />

      <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-sm text-slate-400">
        <p className="mb-2 font-medium text-slate-300">Dos cosas que conviene saber</p>
        <p className="mb-1">
          <strong className="font-medium text-slate-300">
            Los archivos se pisan entre sí y está bien.
          </strong>{" "}
          Exportar el mismo rango varias veces es lo normal. Cada fila se
          reconoce por lo que dice, así que subir dos veces lo mismo no duplica
          nada.
        </p>
        <p>
          <strong className="font-medium text-slate-300">
            Un archivo puede tener varios departamentos.
          </strong>{" "}
          La exportación se hace por propietario, y un propietario puede tener
          varias unidades. Cada fila se imputa por su anuncio, una por una.
        </p>
      </div>
    </main>
  );
}
