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

export default function Tablas({
  celdas,
  programados,
}: {
  celdas: Celda[];
  /** Lo que está por cobrarse. Solo aporta ganancia: no entró nada todavía. */
  programados: Celda[];
}) {
  const meses = useMemo(
    () => [...new Set([...celdas, ...programados].map((c) => c.mes))].sort(),
    [celdas, programados],
  );
  const [mesElegido, setMesElegido] = useState<string>("");
  const [deptoElegido, setDeptoElegido] = useState<string>("");
  const [conProximos, setConProximos] = useState(false);
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

  const proximosVisibles = useMemo(
    () =>
      programados.filter(
        (c) =>
          (mesElegido === "" || c.mes === mesElegido) &&
          (deptoElegido === "" || c.depto_id === deptoElegido),
      ),
    [programados, mesElegido, deptoElegido],
  );

  /**
   * Lo cobrado y lo por cobrar se suman por separado y recién se juntan al
   * mostrarlos. Mezclarlos antes haría imposible decir cuánto del mes ya
   * entró, que es justamente lo que uno quiere saber al mirar un mes en curso.
   */
  const porMes = useMemo(() => {
    const m = new Map<string, { real: Celda[]; prox: Celda[] }>();
    const meter = (c: Celda, cual: "real" | "prox") => {
      const v = m.get(c.mes) ?? { real: [], prox: [] };
      v[cual].push(c);
      m.set(c.mes, v);
    };
    for (const c of visibles) meter(c, "real");
    if (conProximos) for (const c of proximosVisibles) meter(c, "prox");

    return [...m.entries()].map(([mes, { real, prox }]) => ({
      clave: mes,
      etiqueta: nombreMes(mes),
      mes,
      comision: real.reduce((s, c) => s + c.comision, 0),
      limpieza: real.reduce((s, c) => s + c.limpieza, 0),
      reservas: real.reduce((s, c) => s + c.reservas, 0),
      porCobrar: prox.reduce((s, c) => s + c.comision + c.limpieza, 0),
      reservasPorCobrar: prox.reduce((s, c) => s + c.reservas, 0),
    }));
  }, [visibles, proximosVisibles, conProximos]);

  const porDepto = useMemo(() => {
    const delMes = (c: Celda) => mesElegido === "" || c.mes === mesElegido;
    const m = new Map<string, { codigo: string; real: Celda[]; prox: Celda[] }>();
    const meter = (c: Celda, cual: "real" | "prox") => {
      const v = m.get(c.depto_id) ?? { codigo: c.codigo, real: [], prox: [] };
      v[cual].push(c);
      m.set(c.depto_id, v);
    };
    for (const c of celdas.filter(delMes)) meter(c, "real");
    if (conProximos) for (const c of programados.filter(delMes)) meter(c, "prox");

    return [...m.entries()].map(([id, { codigo, real, prox }]) => ({
      clave: id,
      codigo,
      comision: real.reduce((s, c) => s + c.comision, 0),
      limpieza: real.reduce((s, c) => s + c.limpieza, 0),
      percibido: real.reduce((s, c) => s + c.percibido, 0),
      reservas: real.reduce((s, c) => s + c.reservas, 0),
      porCobrar: prox.reduce((s, c) => s + c.comision + c.limpieza, 0),
    }));
  }, [celdas, programados, mesElegido, conProximos]);

  function ordenar<T extends Record<string, unknown>>(filas: T[], o: Orden): T[] {
    return [...filas].sort((a, b) => {
      // "Ganancia" ordena por lo que se ve en esa columna: con la tilde
      // puesta, eso incluye lo que falta cobrar.
      const valor = (f: T) =>
        o.campo === "ganancia"
          ? ganancia(f as never) + Number(f.porCobrar ?? 0)
          : f[o.campo];
      const va = valor(a);
      const vb = valor(b);
      const cmp =
        typeof va === "string" && typeof vb === "string"
          ? va.localeCompare(vb)
          : Number(va) - Number(vb);
      return o.asc ? cmp : -cmp;
    });
  }

  const filasMes = ordenar(porMes, ordenMes);
  const filasDepto = ordenar(porDepto, ordenDepto);
  const maxGanancia = Math.max(...filasMes.map((f) => ganancia(f) + f.porCobrar), 1);

  const totalMes = {
    comision: filasMes.reduce((s, f) => s + f.comision, 0),
    limpieza: filasMes.reduce((s, f) => s + f.limpieza, 0),
    reservas: filasMes.reduce((s, f) => s + f.reservas, 0),
    porCobrar: filasMes.reduce((s, f) => s + f.porCobrar, 0),
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

        {programados.length > 0 && (
          <label className="flex h-11 cursor-pointer items-center gap-2 self-end rounded-md border border-borde-control bg-superficie px-3">
            <input
              type="checkbox"
              checked={conProximos}
              onChange={(e) => setConProximos(e.target.checked)}
              className="size-4 accent-primary"
            />
            <span className="text-sm text-tinta">Sumar próximos cobros</span>
          </label>
        )}

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
            {conProximos && (
              <>
                {" "}
                Lo que está{" "}
                <span className="font-medium text-dato-text">por cobrarse</span> se suma
                aparte: es una previsión de Airbnb, no plata que ya entró.
              </>
            )}
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
                {conProximos && (
                  <Th campo="porCobrar" orden={ordenMes} setOrden={setOrdenMes} alDerecha>
                    Por cobrar
                  </Th>
                )}
                <Th campo="ganancia" orden={ordenMes} setOrden={setOrdenMes} alDerecha>
                  {conProximos ? "Total" : "Ganancia"}
                </Th>
                <Th campo="reservas" orden={ordenMes} setOrden={setOrdenMes} alDerecha>
                  Reservas
                </Th>
              </tr>
            </thead>
            <tbody>
              {filasMes.map((f) => {
                const g = ganancia(f);
                const conTodo = g + f.porCobrar;
                const pctComision = conTodo === 0 ? 0 : (f.comision / conTodo) * 100;
                const pctLimpieza = conTodo === 0 ? 0 : (f.limpieza / conTodo) * 100;
                return (
                  <tr key={f.clave} className="h-fila border-t border-borde">
                    <td className="whitespace-nowrap px-3 py-2 font-medium">{f.etiqueta}</td>
                    <td className="px-3 py-2">
                      {/* El ancho es la ganancia contra el mejor mes; el corte,
                          la composición. No es decoración. */}
                      <span
                        className="flex h-3 overflow-hidden rounded-full bg-superficie-alt"
                        style={{
                          width: `${Math.max(((g + f.porCobrar) / maxGanancia) * 100, 2)}%`,
                        }}
                        title={`comisión ${usd(f.comision)} · limpieza ${usd(f.limpieza)}${
                          f.porCobrar ? ` · por cobrar ${usd(f.porCobrar)}` : ""
                        }`}
                      >
                        <span className="bg-primary" style={{ width: `${pctComision}%` }} />
                        <span className="bg-accent" style={{ width: `${pctLimpieza}%` }} />
                        {/* Lo que falta cobrar va en azul: es una previsión,
                            no plata hecha, y tiene que distinguirse. */}
                        <span className="flex-1 bg-dato-soft" />
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">{usd(f.comision)}</td>
                    <td className="px-3 py-2 text-right">{usd(f.limpieza)}</td>
                    {conProximos && (
                      <td className="px-3 py-2 text-right text-dato-text">
                        {f.porCobrar === 0 ? "—" : usd(f.porCobrar)}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right font-semibold">
                      {usd(g + f.porCobrar)}
                    </td>
                    <td className="px-3 py-2 text-right text-tinta-suave">
                      {f.reservas}
                      {conProximos && f.reservasPorCobrar > 0 && (
                        <span className="text-dato-text"> +{f.reservasPorCobrar}</span>
                      )}
                    </td>
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
                {conProximos && (
                  <td className="px-3 py-2 text-right text-dato-text">
                    {usd(totalMes.porCobrar)}
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  {usd(ganancia(totalMes) + totalMes.porCobrar)}
                </td>
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
                {conProximos && (
                  <Th campo="porCobrar" orden={ordenDepto} setOrden={setOrdenDepto} alDerecha>
                    Por cobrar
                  </Th>
                )}
                <Th campo="ganancia" orden={ordenDepto} setOrden={setOrdenDepto} alDerecha>
                  {conProximos ? "Total" : "Ganancia"}
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
                  {conProximos && (
                    <td className="px-3 py-2 text-right text-dato-text">
                      {d.porCobrar === 0 ? "—" : usd(d.porCobrar)}
                    </td>
                  )}
                  <td className="px-3 py-2 text-right font-semibold">
                    {usd(ganancia(d) + d.porCobrar)}
                  </td>
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
