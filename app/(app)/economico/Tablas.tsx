"use client";

import { useMemo, useState } from "react";

/**
 * Las dos tablas del resumen, ordenables por cualquier columna y filtrables
 * por mes.
 *
 * Es cliente y no servidor por una razón concreta: son 7 meses y ~54
 * departamentos ya calculados. Reordenar eso en el navegador es instantáneo,
 * mientras que hacerlo por dirección obligaría a recalcular los 5.700
 * movimientos en cada clic sobre un encabezado.
 *
 * El servidor hace la cuenta cara una vez; acá solo se acomoda el resultado.
 */

export type Celda = {
  depto_id: string;
  codigo: string;
  mes: string;
  comision: number;
  limpieza: number;
  percibido: number;
  aircover: number;
  reservas: number;
};

const MESES = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** `2026-04` → `abr 26`. */
function nombreMes(mes: string): string {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`;
}

const usd = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ganancia = (c: { comision: number; limpieza: number }) => c.comision + c.limpieza;

type Orden = { campo: string; asc: boolean };

/** Encabezado que ordena. La flecha dice por cuál y en qué sentido. */
function Th({
  campo,
  children,
  orden,
  setOrden,
  alDerecha,
  ancho,
}: {
  campo: string;
  children: React.ReactNode;
  orden: Orden;
  setOrden: (o: Orden) => void;
  alDerecha?: boolean;
  ancho?: string;
}) {
  const activo = orden.campo === campo;
  return (
    <th className={`px-3 py-2 ${alDerecha ? "text-right" : "text-left"} ${ancho ?? ""}`}>
      <button
        type="button"
        // Primer clic en una columna nueva: descendente en los números y
        // ascendente en los textos, que es lo que uno espera de cada uno.
        onClick={() =>
          setOrden(
            activo
              ? { campo, asc: !orden.asc }
              : { campo, asc: campo === "codigo" || campo === "mes" },
          )
        }
        className={`inline-flex min-h-9 items-center gap-1 font-semibold transition-colors hover:text-tinta ${
          activo ? "text-tinta" : "text-warm-700"
        }`}
      >
        {children}
        <span aria-hidden className={activo ? "" : "opacity-25"}>
          {activo && !orden.asc ? "▾" : "▴"}
        </span>
      </button>
    </th>
  );
}

export default function Tablas({ celdas }: { celdas: Celda[] }) {
  const meses = useMemo(
    () => [...new Set(celdas.map((c) => c.mes))].sort(),
    [celdas],
  );
  const [mesElegido, setMesElegido] = useState<string>("");
  const [deptoElegido, setDeptoElegido] = useState<string>("");
  const [ordenMes, setOrdenMes] = useState<Orden>({ campo: "mes", asc: true });
  const [ordenDepto, setOrdenDepto] = useState<Orden>({ campo: "ganancia", asc: false });

  // El filtro de mes afecta a las dos tablas; el de departamento, solo a la
  // evolución mensual: en la tabla por departamento sería una sola fila.
  const visibles = useMemo(
    () =>
      celdas.filter(
        (c) =>
          (mesElegido === "" || c.mes === mesElegido) &&
          (deptoElegido === "" || c.depto_id === deptoElegido),
      ),
    [celdas, mesElegido, deptoElegido],
  );

  const porMes = useMemo(() => {
    const m = new Map<string, Celda[]>();
    for (const c of visibles) m.set(c.mes, [...(m.get(c.mes) ?? []), c]);
    return [...m.entries()].map(([mes, cs]) => ({
      clave: mes,
      etiqueta: nombreMes(mes),
      mes,
      comision: cs.reduce((s, c) => s + c.comision, 0),
      limpieza: cs.reduce((s, c) => s + c.limpieza, 0),
      reservas: cs.reduce((s, c) => s + c.reservas, 0),
    }));
  }, [visibles]);

  const porDepto = useMemo(() => {
    const m = new Map<string, Celda[]>();
    for (const c of celdas.filter((c) => mesElegido === "" || c.mes === mesElegido)) {
      m.set(c.depto_id, [...(m.get(c.depto_id) ?? []), c]);
    }
    return [...m.entries()].map(([id, cs]) => ({
      clave: id,
      codigo: cs[0].codigo,
      comision: cs.reduce((s, c) => s + c.comision, 0),
      limpieza: cs.reduce((s, c) => s + c.limpieza, 0),
      percibido: cs.reduce((s, c) => s + c.percibido, 0),
      reservas: cs.reduce((s, c) => s + c.reservas, 0),
    }));
  }, [celdas, mesElegido]);

  function ordenar<T extends Record<string, unknown>>(filas: T[], o: Orden): T[] {
    return [...filas].sort((a, b) => {
      const va = o.campo === "ganancia" ? ganancia(a as never) : a[o.campo];
      const vb = o.campo === "ganancia" ? ganancia(b as never) : b[o.campo];
      const cmp =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb)
          : Number(va) - Number(vb);
      return o.asc ? cmp : -cmp;
    });
  }

  const filasMes = ordenar(porMes, ordenMes);
  const filasDepto = ordenar(porDepto, ordenDepto);
  const maxGanancia = Math.max(...filasMes.map(ganancia), 1);

  const totalMes = {
    comision: filasMes.reduce((s, f) => s + f.comision, 0),
    limpieza: filasMes.reduce((s, f) => s + f.limpieza, 0),
    reservas: filasMes.reduce((s, f) => s + f.reservas, 0),
  };

  const CONTROL =
    "h-11 rounded-md border border-borde-control bg-superficie px-3 text-sm text-tinta outline-none focus:border-primary";

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-tinta-tenue">
            Mes
          </span>
          <select
            value={mesElegido}
            onChange={(e) => setMesElegido(e.target.value)}
            className={CONTROL}
          >
            <option value="">Todos los meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-tinta-tenue">
            Departamento
          </span>
          <select
            value={deptoElegido}
            onChange={(e) => setDeptoElegido(e.target.value)}
            className={CONTROL}
          >
            <option value="">Todos</option>
            {[...new Map(celdas.map((c) => [c.depto_id, c.codigo]))]
              .sort((a, b) => a[1].localeCompare(b[1]))
              .map(([id, codigo]) => (
                <option key={id} value={id}>
                  {codigo}
                </option>
              ))}
          </select>
        </label>

        {(mesElegido || deptoElegido) && (
          <button
            type="button"
            onClick={() => {
              setMesElegido("");
              setDeptoElegido("");
            }}
            className="h-11 rounded-md px-3 text-sm text-tinta-suave underline"
          >
            limpiar filtros
          </button>
        )}
      </div>

      {/* ---- Evolución mensual ---- */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-tinta">Ganancia mes a mes</h2>
          <p className="text-sm text-tinta-suave">
            La barra separa de qué está hecha:{" "}
            <span className="font-medium text-primary">comisión</span> sobre el alquiler y{" "}
            <span className="font-medium text-accent">limpieza</span>, que va entera a
            MTHosting y no comisiona. Tocá cualquier encabezado para ordenar.
          </p>
        </div>

        <div className="overflow-x-auto rounded-md border border-borde bg-superficie shadow-sm">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-superficie-alt text-[13px]">
              <tr>
                <Th campo="mes" orden={ordenMes} setOrden={setOrdenMes}>
                  Mes
                </Th>
                <th className="w-2/5 px-3 py-2 text-left text-[13px] font-semibold text-warm-700">
                  Composición
                </th>
                <Th campo="comision" orden={ordenMes} setOrden={setOrdenMes} alDerecha>
                  Comisión
                </Th>
                <Th campo="limpieza" orden={ordenMes} setOrden={setOrdenMes} alDerecha>
                  Limpieza
                </Th>
                <Th campo="ganancia" orden={ordenMes} setOrden={setOrdenMes} alDerecha>
                  Ganancia
                </Th>
                <Th campo="reservas" orden={ordenMes} setOrden={setOrdenMes} alDerecha>
                  Reservas
                </Th>
              </tr>
            </thead>
            <tbody>
              {filasMes.map((f) => {
                const g = ganancia(f);
                const pctComision = g === 0 ? 0 : (f.comision / g) * 100;
                return (
                  <tr key={f.clave} className="h-fila border-t border-borde">
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{f.etiqueta}</td>
                    <td className="px-3 py-2">
                      {/* El ancho es la ganancia contra el mejor mes; el corte,
                          la composición. No es decoración. */}
                      <span
                        className="flex h-3 overflow-hidden rounded-full bg-superficie-alt"
                        style={{ width: `${Math.max((g / maxGanancia) * 100, 2)}%` }}
                        title={`comisión ${usd(f.comision)} · limpieza ${usd(f.limpieza)}`}
                      >
                        <span className="bg-primary" style={{ width: `${pctComision}%` }} />
                        <span className="flex-1 bg-accent" />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{usd(f.comision)}</td>
                    <td className="px-3 py-2 text-right">{usd(f.limpieza)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{usd(g)}</td>
                    <td className="px-3 py-2 text-right text-tinta-suave">{f.reservas}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="h-fila border-t-2 border-borde-fuerte bg-superficie-alt font-semibold">
                <td className="px-3 py-2" colSpan={2}>
                  Total
                </td>
                <td className="px-3 py-2 text-right">{usd(totalMes.comision)}</td>
                <td className="px-3 py-2 text-right">{usd(totalMes.limpieza)}</td>
                <td className="px-3 py-2 text-right">{usd(ganancia(totalMes))}</td>
                <td className="px-3 py-2 text-right">{totalMes.reservas}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* ---- Por departamento ---- */}
      <section className="flex flex-col gap-3">
        <div>
          <h2 className="font-semibold text-tinta">
            Por departamento
            {mesElegido && (
              <span className="ml-2 text-sm font-normal text-tinta-suave">
                {nombreMes(mesElegido)}
              </span>
            )}
          </h2>
          <p className="text-sm text-tinta-suave">
            Arranca ordenado por ganancia, que es lo que mide la rentabilidad. Lo percibido
            no sirve para comparar: un departamento donde se cobró de más para recuperar
            una deuda aparecería primero sin ser el mejor.
          </p>
        </div>
        <div className="overflow-x-auto rounded-md border border-borde bg-superficie shadow-sm">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-superficie-alt text-[13px]">
              <tr>
                <Th campo="codigo" orden={ordenDepto} setOrden={setOrdenDepto}>
                  Departamento
                </Th>
                <Th campo="comision" orden={ordenDepto} setOrden={setOrdenDepto} alDerecha>
                  Comisión
                </Th>
                <Th campo="limpieza" orden={ordenDepto} setOrden={setOrdenDepto} alDerecha>
                  Limpieza
                </Th>
                <Th campo="ganancia" orden={ordenDepto} setOrden={setOrdenDepto} alDerecha>
                  Ganancia
                </Th>
                <Th campo="reservas" orden={ordenDepto} setOrden={setOrdenDepto} alDerecha>
                  Reservas
                </Th>
                <Th campo="percibido" orden={ordenDepto} setOrden={setOrdenDepto} alDerecha>
                  Percibido
                </Th>
              </tr>
            </thead>
            <tbody>
              {filasDepto.map((d) => (
                <tr
                  key={d.clave}
                  className={`h-fila border-t border-borde ${
                    d.clave === deptoElegido ? "bg-superficie-elegida" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() =>
                        setDeptoElegido(d.clave === deptoElegido ? "" : d.clave)
                      }
                      className="font-mono font-semibold text-primary underline"
                    >
                      {d.codigo}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">{usd(d.comision)}</td>
                  <td className="px-3 py-2 text-right">{usd(d.limpieza)}</td>
                  <td className="px-3 py-2 text-right font-semibold">{usd(ganancia(d))}</td>
                  <td className="px-3 py-2 text-right text-tinta-suave">{d.reservas}</td>
                  <td className="px-3 py-2 text-right text-tinta-suave">
                    {usd(d.percibido)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
