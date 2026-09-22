import FormularioImportar from "./FormularioImportar";

export default function ImportarEconomico() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">
          Importar cobros de Airbnb
        </h1>
        <p className="text-sm text-tinta-tenue">
          Ganancias → Historial de transacciones, exportado a CSV. Se cargan todos
          los archivos juntos y una fila ya cargada no se vuelve a tomar.
        </p>
      </div>

      <FormularioImportar />

      <div className="rounded-xl border border-borde bg-superficie p-4 text-sm text-tinta-tenue">
        <p className="mb-2 font-medium text-tinta-suave">Dos cosas que conviene saber</p>
        <p className="mb-1">
          <strong className="font-medium text-tinta-suave">
            Los archivos se pisan entre sí y está bien.
          </strong>{" "}
          Exportar el mismo rango varias veces es lo normal. Cada fila se
          reconoce por lo que dice, así que subir dos veces lo mismo no duplica
          nada.
        </p>
        <p>
          <strong className="font-medium text-tinta-suave">
            Un archivo puede tener varios departamentos.
          </strong>{" "}
          La exportación se hace por propietario, y un propietario puede tener
          varias unidades. Cada fila se imputa por su anuncio, una por una.
        </p>
      </div>
    </main>
  );
}
