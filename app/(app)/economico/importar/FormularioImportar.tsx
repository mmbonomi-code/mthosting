"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { unzipSync, strFromU8 } from "fflate";
import { clsBotonPrimario, clsBotonSecundario } from "@/lib/ui";
import type {
  ResultadoArchivoImportado,
  ResumenLote,
} from "@/lib/economico/importar";
import {
  abrirImportacion,
  cerrarImportacion,
  procesarArchivo,
} from "../acciones";

type Pendiente = { nombre: string; contenido: string };

type Estado =
  | { paso: "eligiendo" }
  | { paso: "procesando"; hechos: number; total: number; actual: string }
  | { paso: "listo"; resumen: ResumenLote; archivos: ResultadoArchivoImportado[] };

/** Un export de Ganancias suele llamarse airbnb_pending... cuando es futuro. */
function pareceProgramado(nombres: string[]): boolean {
  return nombres.length > 0 && nombres.every((n) => /pending|proximo|programad/i.test(n));
}

export default function FormularioImportar() {
  const [pendientes, setPendientes] = useState<Pendiente[]>([]);
  const [tipo, setTipo] = useState<"efectivo" | "programado">("efectivo");
  const [tipoTocado, setTipoTocado] = useState(false);
  const [estado, setEstado] = useState<Estado>({ paso: "eligiendo" });
  const [encima, setEncima] = useState(false);
  const [rechazados, setRechazados] = useState<string[]>([]);
  const entrada = useRef<HTMLInputElement>(null);
  const carpeta = useRef<HTMLInputElement>(null);

  /**
   * Convierte lo que caiga —archivos sueltos, una carpeta entera o un .zip—
   * en una lista de CSV. El .zip se abre acá, en el navegador: mandar el
   * comprimido al servidor no aporta nada y pesa más.
   */
  async function agregar(archivos: File[]) {
    const nuevos: Pendiente[] = [];
    const fuera: string[] = [];

    for (const archivo of archivos) {
      if (/\.zip$/i.test(archivo.name)) {
        try {
          const contenido = unzipSync(new Uint8Array(await archivo.arrayBuffer()));
          for (const [ruta, bytes] of Object.entries(contenido)) {
            if (!/\.csv$/i.test(ruta) || bytes.length === 0) continue;
            nuevos.push({ nombre: ruta.split("/").pop()!, contenido: strFromU8(bytes) });
          }
        } catch {
          fuera.push(`${archivo.name} (no se pudo abrir el comprimido)`);
        }
      } else if (/\.csv$/i.test(archivo.name)) {
        nuevos.push({ nombre: archivo.name, contenido: await archivo.text() });
      } else {
        fuera.push(archivo.name);
      }
    }

    setRechazados(fuera);
    setPendientes((previos) => {
      // Mismo nombre dos veces en la misma tanda: se queda el último.
      const porNombre = new Map(previos.map((p) => [p.nombre, p]));
      for (const n of nuevos) porNombre.set(n.nombre, n);
      const lista = [...porNombre.values()];
      if (!tipoTocado) {
        setTipo(pareceProgramado(lista.map((l) => l.nombre)) ? "programado" : "efectivo");
      }
      return lista;
    });
  }

  /** Una carpeta arrastrada llega como entrada de directorio, no como File. */
  async function desdeDrop(transfer: DataTransfer): Promise<File[]> {
    const raiz = [...transfer.items]
      .map((i) => (i.kind === "file" ? i.webkitGetAsEntry() : null))
      .filter((e): e is FileSystemEntry => e !== null);
    if (raiz.length === 0) return [...transfer.files];

    const encontrados: File[] = [];
    const recorrer = async (entrada: FileSystemEntry): Promise<void> => {
      if (entrada.isFile) {
        const archivo = await new Promise<File>((ok, mal) =>
          (entrada as FileSystemFileEntry).file(ok, mal),
        );
        encontrados.push(archivo);
        return;
      }
      const lector = (entrada as FileSystemDirectoryEntry).createReader();
      // readEntries devuelve de a tandas: hay que insistir hasta que dé vacío.
      for (;;) {
        const tanda = await new Promise<FileSystemEntry[]>((ok, mal) =>
          lector.readEntries(ok, mal),
        );
        if (tanda.length === 0) break;
        for (const hijo of tanda) await recorrer(hijo);
      }
    };
    for (const e of raiz) await recorrer(e);
    return encontrados;
  }

  async function importar() {
    if (pendientes.length === 0) return;

    const importId = await abrirImportacion(tipo);
    const resultados: ResultadoArchivoImportado[] = [];

    for (const [i, archivo] of pendientes.entries()) {
      setEstado({
        paso: "procesando",
        hechos: i,
        total: pendientes.length,
        actual: archivo.nombre,
      });
      // De a uno: así se ve el avance y un archivo roto no corta el lote.
      resultados.push(await procesarArchivo(importId, archivo.nombre, archivo.contenido));
    }

    const resumen = await cerrarImportacion(importId);
    setEstado({ paso: "listo", resumen, archivos: resultados });
    setPendientes([]);
  }

  if (estado.paso === "procesando") {
    const pct = Math.round((estado.hechos / estado.total) * 100);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-800/40 p-6">
        <p className="text-slate-200">
          Procesando {estado.hechos + 1} de {estado.total}
        </p>
        <p className="truncate text-sm text-slate-500">{estado.actual}</p>
        <div className="h-2 overflow-hidden rounded-full bg-slate-700">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500">
          No cierres esta pantalla hasta que termine.
        </p>
      </div>
    );
  }

  if (estado.paso === "listo") return <Resumen {...estado} onSeguir={() => setEstado({ paso: "eligiendo" })} />;

  return (
    <div className="flex flex-col gap-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setEncima(false);
          await agregar(await desdeDrop(e.dataTransfer));
        }}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          encima ? "border-emerald-500 bg-emerald-950/20" : "border-slate-700 bg-slate-800/40"
        }`}
      >
        <p className="text-slate-200">
          Arrastrá acá los CSV, una carpeta entera o un .zip
        </p>
        <p className="text-sm text-slate-500">
          Se importan todos juntos, como un solo lote
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => entrada.current?.click()}
            className={clsBotonSecundario}
          >
            Elegir archivos
          </button>
          <button
            type="button"
            onClick={() => carpeta.current?.click()}
            className={clsBotonSecundario}
          >
            Elegir una carpeta
          </button>
        </div>
        <input
          ref={entrada}
          type="file"
          accept=".csv,.zip"
          multiple
          hidden
          onChange={(e) => {
            void agregar([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
        <input
          ref={carpeta}
          type="file"
          hidden
          multiple
          // @ts-expect-error atributo de navegador, no está en los tipos de React
          webkitdirectory=""
          onChange={(e) => {
            void agregar([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </div>

      {rechazados.length > 0 && (
        <p className="text-sm text-amber-300">
          Quedaron afuera {rechazados.length} archivo
          {rechazados.length === 1 ? "" : "s"} que no son CSV: {rechazados.join(", ")}
        </p>
      )}

      {pendientes.length > 0 && (
        <>
          <div className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-white">
                {pendientes.length} archivo{pendientes.length === 1 ? "" : "s"} listo
                {pendientes.length === 1 ? "" : "s"}
              </span>
              <button
                type="button"
                onClick={() => setPendientes([])}
                className="text-sm text-slate-400 underline underline-offset-4 hover:text-white"
              >
                Vaciar
              </button>
            </div>
            <ul className="max-h-48 overflow-y-auto text-sm text-slate-400">
              {pendientes.map((p) => (
                <li key={p.nombre} className="truncate py-0.5">
                  {p.nombre}
                </li>
              ))}
            </ul>
          </div>

          <fieldset className="flex flex-col gap-2 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <legend className="px-1 text-sm text-slate-400">Qué son estos archivos</legend>
            {(
              [
                {
                  valor: "efectivo",
                  titulo: "Cobros efectivos",
                  detalle: "Lo que ya se cobró. Se acumula con lo que hay: nada se pisa.",
                },
                {
                  valor: "programado",
                  titulo: "Programados",
                  detalle:
                    "Lo que está por cobrarse. Reemplaza por completo a los programados anteriores.",
                },
              ] as const
            ).map((o) => (
              <label key={o.valor} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="tipo"
                  checked={tipo === o.valor}
                  onChange={() => {
                    setTipo(o.valor);
                    setTipoTocado(true);
                  }}
                  className="mt-1"
                />
                <span>
                  <span className="block text-slate-100">{o.titulo}</span>
                  <span className="block text-sm text-slate-500">{o.detalle}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <button type="button" onClick={importar} className={clsBotonPrimario}>
            Importar {pendientes.length} archivo{pendientes.length === 1 ? "" : "s"}
          </button>
        </>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------

function Numero({ etiqueta, valor, color }: { etiqueta: string; valor: number; color: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <span className={`text-2xl font-semibold tabular-nums ${color}`}>
        {valor.toLocaleString("es-AR")}
      </span>
    </div>
  );
}

/** Un resumen del LOTE entero, no un mensaje por archivo. */
function Resumen({
  resumen,
  archivos,
  onSeguir,
}: {
  resumen: ResumenLote;
  archivos: ResultadoArchivoImportado[];
  onSeguir: () => void;
}) {
  const fallados = archivos.filter((a) => a.error);
  const avisos = [
    ...new Set(archivos.flatMap((a) => a.avisos.map((t) => `${a.nombre}: ${t}`))),
  ];

  return (
    <div className="flex flex-col gap-4">
      <section className="grid grid-cols-2 gap-4 rounded-xl border border-slate-800 bg-slate-800/40 p-4 sm:grid-cols-4">
        <Numero etiqueta="Archivos" valor={resumen.archivos} color="text-white" />
        <Numero etiqueta="Filas nuevas" valor={resumen.filas_nuevas} color="text-emerald-300" />
        <Numero
          etiqueta="Ya estaban"
          valor={resumen.filas_duplicadas}
          color="text-slate-400"
        />
        <Numero
          etiqueta="Sin departamento"
          valor={resumen.filas_sin_mapear}
          color={resumen.filas_sin_mapear > 0 ? "text-amber-300" : "text-slate-400"}
        />
      </section>

      <p className="text-sm text-slate-400">
        Se leyeron {resumen.filas_leidas.toLocaleString("es-AR")} filas.{" "}
        {resumen.filas_duplicadas > 0 && (
          <>
            Las {resumen.filas_duplicadas.toLocaleString("es-AR")} que ya estaban no se
            volvieron a cargar: los exports se pisan entre sí y eso es lo esperable.
          </>
        )}
      </p>

      {/* Lo que queda por hacer. Son las dos cosas que, sin resolver, dejan
          plata afuera de los números. */}
      {(resumen.anuncios_sin_mapear > 0 || resumen.cuentas_sin_clasificar > 0) && (
        <div className="flex flex-col gap-2 rounded-xl border border-amber-900 bg-amber-950/30 p-4">
          <p className="font-medium text-amber-200">Falta resolver esto</p>
          {resumen.anuncios_sin_mapear > 0 && (
            <Link
              href="/economico/anuncios"
              className="text-sm text-amber-100 underline underline-offset-4"
            >
              {resumen.anuncios_sin_mapear} anuncio
              {resumen.anuncios_sin_mapear === 1 ? "" : "s"} sin departamento →
            </Link>
          )}
          {resumen.cuentas_sin_clasificar > 0 && (
            <Link
              href="/economico/cuentas"
              className="text-sm text-amber-100 underline underline-offset-4"
            >
              {resumen.cuentas_sin_clasificar} cuenta
              {resumen.cuentas_sin_clasificar === 1 ? "" : "s"} de payout sin clasificar →
            </Link>
          )}
        </div>
      )}

      {fallados.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl border border-red-900 bg-red-950/30 p-4">
          <p className="font-medium text-red-200">
            {fallados.length} archivo{fallados.length === 1 ? "" : "s"} no se pudo leer
          </p>
          <p className="text-xs text-red-200/70">
            El resto del lote se importó igual.
          </p>
          <ul className="mt-1 text-sm text-red-100">
            {fallados.map((a) => (
              <li key={a.nombre}>
                <span className="font-medium">{a.nombre}</span>: {a.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {avisos.length > 0 && (
        <details className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
          <summary className="cursor-pointer text-sm text-slate-300">
            {avisos.length} aviso{avisos.length === 1 ? "" : "s"} del lote
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-400">
            {avisos.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
        <summary className="cursor-pointer text-sm text-slate-300">
          Archivo por archivo
        </summary>
        <ul className="mt-2 flex flex-col gap-1 text-sm">
          {archivos.map((a) => (
            <li key={a.nombre} className="flex flex-wrap items-baseline gap-x-3">
              <span className="min-w-0 flex-1 truncate text-slate-300">{a.nombre}</span>
              <span className="tabular-nums text-emerald-300">+{a.filas_nuevas}</span>
              <span className="tabular-nums text-slate-500">
                {a.filas_duplicadas} repetidas
              </span>
            </li>
          ))}
        </ul>
      </details>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSeguir} className={clsBotonSecundario}>
          Importar más
        </button>
        <Link
          href="/economico/importaciones"
          className="flex h-11 items-center px-2 text-sm text-slate-400 hover:text-white"
        >
          Ver las importaciones (y deshacer esta) →
        </Link>
      </div>
    </div>
  );
}
