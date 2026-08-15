import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearFechaAR } from "@/lib/fechas";
import {
  agregarPorDeptoMes,
  ganancia,
  saldoPropietario,
  totalizar,
  type Aporte,
  type ClaseCuenta,
  type FilaAgregable,
} from "@/lib/economico/calcular";
import {
  chequeos,
  contarGrupos,
  revisarGrupos,
  tcFueraDeLinea,
  type FilaDeGrupo,
} from "@/lib/economico/validar";
import Badge from "@/app/componentes/Badge";
import { TONO_LIMPIEZA, TONO_RESERVA } from "@/lib/estados";

/**
 * Conciliación (spec §6.6). Va ANTES que el dashboard a propósito: un total
 * que no se puede auditar no sirve, por lindo que sea.
 *
 * Todo lo que se muestra acá se recalcula al abrir la página, desde los
 * movimientos crudos. No lee ningún total guardado: si hubiera una diferencia
 * entre lo que se guardó y lo que sale de los datos, esta pantalla tiene que
 * ser la que la delate, no la que la repita.
 */

const CAMPOS = `
  archivo, linea, grupo_payout, es_payout, categoria, monto, cobrado,
  tarifa_limpieza, moneda, fecha, depto_id, anuncio, cuenta_id,
  grupo_con_coanfitrion, codigo_confirmacion, huesped
`;

type Cruda = {
  archivo: string;
  linea: number;
  grupo_payout: number | null;
  es_payout: boolean;
  categoria: FilaAgregable["categoria"];
  monto: number | null;
  cobrado: number | null;
  tarifa_limpieza: number | null;
  moneda: string;
  fecha: string;
  depto_id: string | null;
  anuncio: string | null;
  cuenta_id: string | null;
  grupo_con_coanfitrion: boolean;
  codigo_confirmacion: string | null;
  huesped: string | null;
};

/** PostgREST corta en 1000 y no avisa. Paginar es corrección, no ajuste fino. */
const TOPE = 1000;

const usd = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function Validacion({
  searchParams,
}: {
  searchParams: Promise<{ depto?: string }>;
}) {
  const params = await searchParams;
  const supabase = await crearClienteServidor();

  const crudas: Cruda[] = [];
  for (let desde = 0; ; desde += TOPE) {
    const { data } = await supabase
      .from("movimientos_economicos")
      .select(CAMPOS)
      .order("archivo")
      .order("orden_en_archivo")
      .range(desde, desde + TOPE - 1);
    const tanda = (data ?? []) as unknown as Cruda[];
    crudas.push(...tanda);
    if (tanda.length < TOPE) break;
  }

  const [{ data: deptos }, { data: cuentas }] = await Promise.all([
    supabase.from("departamentos").select("id, codigo, comision_pct").order("codigo"),
    supabase.from("cuentas_payout").select("id, clasificacion, titular, numero"),
  ]);

  const codigoDepto = new Map((deptos ?? []).map((d) => [d.id, d.codigo]));
  const comision = new Map(
    (deptos ?? []).map((d) => [d.id, Number(d.comision_pct ?? 20)]),
  );
  const claseDeCuenta = new Map(
    (cuentas ?? []).map((c) => [c.id, (c.clasificacion ?? "sin_clasificar") as ClaseCuenta]),
  );

  // ---- Integridad de los grupos ----
  const grupos = revisarGrupos(crudas as FilaDeGrupo[]);
  const resumenGrupos = contarGrupos(grupos);
  const tcRaros = tcFueraDeLinea(grupos);

  // ---- Descartes ----
  const anunciosSinMapear = new Set(
    crudas.filter((m) => m.depto_id === null && m.anuncio).map((m) => m.anuncio!),
  ).size;
  const cuentasSinClasificar = (cuentas ?? []).filter(
    (c) => c.clasificacion !== "mth" && c.clasificacion !== "propietario",
  ).length;

  // ---- Los números ----
  const filas: FilaAgregable[] = crudas.map((m) => ({
    categoria: m.categoria,
    monto: m.monto,
    cobrado: m.cobrado,
    tarifa_limpieza: m.tarifa_limpieza,
    moneda: m.moneda,
    fecha: m.fecha,
    depto_id: m.depto_id,
    grupo_con_coanfitrion: m.grupo_con_coanfitrion,
    clase_cuenta:
      m.cuenta_id === null ? "sin_clasificar" : (claseDeCuenta.get(m.cuenta_id) ?? "sin_clasificar"),
  }));
  const { celdas, sinConvertir } = agregarPorDeptoMes(filas, comision);

  const semaforo = chequeos({
    grupos: resumenGrupos,
    anunciosSinMapear,
    cuentasSinClasificar,
    filasSinConvertir: sinConvertir,
    tcRaros: tcRaros.length,
  });
  const todoBien = semaforo.every((c) => c.ok);

  // ---- El detalle de un departamento, si se eligió uno ----
  const elegido = params.depto ?? null;
  const detalle = elegido
    ? crudas
        .filter((m) => m.depto_id === elegido)
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
    : [];

  const porDepto = new Map<string, Aporte[]>();
  for (const c of celdas) {
    porDepto.set(c.depto_id, [...(porDepto.get(c.depto_id) ?? []), c]);
  }

  if (crudas.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
          Validación
        </h1>
        <div className="rounded-md border border-borde bg-superficie px-6 py-12 text-center shadow-sm">
          <p className="text-tinta-suave">
            Todavía no hay movimientos cargados.{" "}
            <Link href="/economico/importar" className="font-medium text-primary underline">
              Importar los cobros de Airbnb
            </Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
          Validación
        </h1>
        <p className="text-sm tabular-nums text-tinta-suave">
          {crudas.length.toLocaleString("es-AR")} movimientos · {resumenGrupos.total} grupos
          de payout · {porDepto.size} departamentos
        </p>
      </div>

      {/* ---- Semáforo ---- */}
      <section
        className={`rounded-md border border-l-[3px] p-4 shadow-sm ${
          todoBien
            ? "border-borde border-l-primary bg-superficie"
            : "border-borde border-l-accent bg-accent-soft"
        }`}
      >
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-tinta-suave">
          Chequeos automáticos
        </h2>
        <ul className="flex flex-col gap-2">
          {semaforo.map((c) => (
            <li key={c.nombre} className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span aria-hidden className={c.ok ? "text-exito" : "text-accent"}>
                {c.ok ? "✓" : "✗"}
              </span>
              <span className={c.ok ? "text-tinta" : "font-semibold text-tinta"}>
                {c.nombre}
              </span>
              <span className="text-tinta-suave">— {c.detalle}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- Grupos que no cierran ---- */}
      {resumenGrupos.no_cierra + resumenGrupos.sin_payout + resumenGrupos.sin_detalle > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-tinta">Grupos para mirar</h2>
          <div className="overflow-x-auto rounded-md border border-borde bg-superficie shadow-sm">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-superficie-alt text-left text-[13px] font-semibold text-warm-700">
                <tr>
                  <th className="px-3 py-2">Archivo</th>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2">Qué pasa</th>
                  <th className="px-3 py-2 text-right">Payout</th>
                  <th className="px-3 py-2 text-right">Suma detalle</th>
                  <th className="px-3 py-2 text-right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {grupos
                  .filter((g) => g.estado !== "cierra" && g.estado !== "otra_moneda")
                  .slice(0, 100)
                  .map((g) => (
                    <tr key={g.clave} className="h-fila border-t border-borde">
                      <td className="truncate px-3 py-2 font-mono text-xs">{g.archivo}</td>
                      <td className="px-3 py-2">{g.numero}</td>
                      <td className="px-3 py-2">
                        <Badge tono={TONO_RESERVA.cancelada}>
                          {g.estado === "no_cierra"
                            ? "no cierra"
                            : g.estado === "sin_payout"
                              ? "sin payout"
                              : "sin detalle"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {g.cobrado === null ? "—" : usd(g.cobrado)}
                      </td>
                      <td className="px-3 py-2 text-right">{usd(g.sumaDetalle)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-accent">
                        {g.diferencia === null ? "—" : usd(g.diferencia)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ---- Tipos de cambio deducidos ---- */}
      {resumenGrupos.otra_moneda > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-semibold text-tinta">
            Tipos de cambio deducidos
            <span className="ml-2 text-sm font-normal text-tinta-suave">
              {resumenGrupos.otra_moneda} grupos con el payout en otra moneda
            </span>
          </h2>
          <p className="text-sm text-tinta-suave">
            No se toma de ninguna tabla: sale de dividir lo cobrado por la suma del
            detalle, así que es el que aplicó Airbnb en esa operación. Sirve sobre todo
            para detectar grupos mal armados: uno muy fuera de línea con los demás
            delata que al payout le emparejaron filas que no son suyas.
          </p>
          {tcRaros.length > 0 ? (
            <div className="overflow-x-auto rounded-md border border-borde border-l-[3px] border-l-accent bg-accent-soft shadow-sm">
              <table className="w-full text-sm tabular-nums">
                <thead className="text-left text-[13px] font-semibold text-accent-soft-text">
                  <tr>
                    <th className="px-3 py-2">Archivo</th>
                    <th className="px-3 py-2">Grupo</th>
                    <th className="px-3 py-2 text-right">Cobrado</th>
                    <th className="px-3 py-2 text-right">Suma detalle</th>
                    <th className="px-3 py-2 text-right">TC deducido</th>
                  </tr>
                </thead>
                <tbody>
                  {tcRaros.slice(0, 50).map((g) => (
                    <tr key={g.clave} className="h-fila border-t border-borde">
                      <td className="truncate px-3 py-2 font-mono text-xs">{g.archivo}</td>
                      <td className="px-3 py-2">{g.numero}</td>
                      <td className="px-3 py-2 text-right">
                        {g.monedaPayout} {usd(g.cobrado ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {g.monedaDetalle} {usd(g.sumaDetalle)}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-accent">
                        {usd(g.tcDeducido ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-md border border-borde bg-superficie px-4 py-3 text-sm text-tinta-suave shadow-sm">
              Todos en línea entre sí. Ninguno sugiere un grupo mal armado.
            </p>
          )}
        </section>
      )}

      {/* ---- Los números por departamento ---- */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-tinta">Por departamento</h2>
        <p className="text-sm text-tinta-suave">
          La <strong>ganancia</strong> es lo que corresponde a MTHosting: define la
          rentabilidad. El <strong>percibido</strong> es todo lo que entró, por
          coanfitrión o por payout a cuenta propia. La <strong>diferencia</strong> es el
          saldo con el propietario: positiva, hay que girarle; negativa, deben.
        </p>
        <div className="overflow-x-auto rounded-md border border-borde bg-superficie shadow-sm">
          <table className="w-full text-sm tabular-nums">
            <thead className="bg-superficie-alt text-left text-[13px] font-semibold text-warm-700">
              <tr>
                <th className="px-3 py-2">Departamento</th>
                <th className="px-3 py-2 text-right">Ganancia</th>
                <th className="px-3 py-2 text-right">Percibido</th>
                <th className="px-3 py-2 text-right">Diferencia</th>
                <th className="px-3 py-2 text-right">AirCover</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {[...porDepto.entries()]
                .sort((a, b) =>
                  (codigoDepto.get(a[0]) ?? "").localeCompare(codigoDepto.get(b[0]) ?? ""),
                )
                .map(([id, celdasDelDepto]) => {
                  const t = totalizar(celdasDelDepto);
                  const dif = saldoPropietario(t);
                  return (
                    <tr key={id} className="h-fila border-t border-borde">
                      <td className="px-3 py-2 font-mono font-semibold">
                        {codigoDepto.get(id) ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-right">{usd(ganancia(t))}</td>
                      <td className="px-3 py-2 text-right">{usd(t.percibido)}</td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          Math.abs(dif) < 0.005
                            ? "text-tinta-tenue"
                            : dif > 0
                              ? "text-accent"
                              : "text-dato"
                        }`}
                      >
                        {usd(dif)}
                      </td>
                      <td className="px-3 py-2 text-right text-tinta-tenue">
                        {t.aircover === 0 ? "—" : usd(t.aircover)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/economico/validacion?depto=${id}`}
                          className="text-sm font-medium text-primary underline"
                        >
                          ver el detalle
                        </Link>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---- Trazabilidad hasta la línea del CSV ---- */}
      {elegido && (
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-tinta">
              {codigoDepto.get(elegido)}
              <span className="ml-2 text-sm font-normal tabular-nums text-tinta-suave">
                {detalle.length} movimientos
              </span>
            </h2>
            <Link href="/economico/validacion" className="text-sm text-tinta-suave underline">
              cerrar
            </Link>
          </div>
          <p className="text-sm text-tinta-suave">
            Cada fila dice de qué archivo y de qué línea salió. Es lo que permite abrir
            el CSV en Excel y mirar el número con los ojos.
          </p>
          <div className="overflow-x-auto rounded-md border border-borde bg-superficie shadow-sm">
            <table className="w-full text-sm tabular-nums">
              <thead className="bg-superficie-alt text-left text-[13px] font-semibold text-warm-700">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Qué es</th>
                  <th className="px-3 py-2">Reserva</th>
                  <th className="px-3 py-2">Huésped</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-right">Limpieza</th>
                  <th className="px-3 py-2">Origen</th>
                </tr>
              </thead>
              <tbody>
                {detalle.slice(0, 400).map((m, i) => (
                  <tr key={`${m.archivo}-${m.linea}-${i}`} className="h-fila border-t border-borde">
                    <td className="whitespace-nowrap px-3 py-2">
                      {formatearFechaAR(m.fecha)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        tono={
                          m.categoria === "aircover"
                            ? TONO_RESERVA.tentativa
                            : m.categoria === "coanfitrion"
                              ? TONO_LIMPIEZA.hecha
                              : TONO_LIMPIEZA.pendiente
                        }
                      >
                        {m.categoria}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {m.codigo_confirmacion ?? "—"}
                    </td>
                    <td className="max-w-40 truncate px-3 py-2 text-tinta-suave">
                      {m.huesped ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {m.moneda} {usd(Number(m.monto ?? m.cobrado ?? 0))}
                    </td>
                    <td className="px-3 py-2 text-right text-tinta-tenue">
                      {m.tarifa_limpieza ? usd(Number(m.tarifa_limpieza)) : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-tinta-tenue">
                      {m.archivo}:{m.linea}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {detalle.length > 400 && (
            <p className="text-xs text-tinta-tenue">
              Se muestran los primeros 400 de {detalle.length}.
            </p>
          )}
        </section>
      )}

      {/* ---- Descartes ---- */}
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-tinta">Qué quedó afuera</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          <Descarte
            valor={anunciosSinMapear}
            que="anuncios sin departamento"
            href="/economico/anuncios"
          />
          <Descarte
            valor={cuentasSinClasificar}
            que="cuentas sin clasificar"
            href="/economico/cuentas"
          />
          <Descarte valor={sinConvertir} que="filas sin tipo de cambio" />
        </div>
      </section>
    </main>
  );
}

function Descarte({
  valor,
  que,
  href,
}: {
  valor: number;
  que: string;
  href?: string;
}) {
  const contenido = (
    <div
      className={`rounded-md border p-4 shadow-sm ${
        valor === 0 ? "border-borde bg-superficie" : "border-borde border-l-[3px] border-l-accent bg-accent-soft"
      }`}
    >
      <p
        className={`text-2xl font-semibold tabular-nums ${
          valor === 0 ? "text-tinta-tenue" : "text-accent-soft-text"
        }`}
      >
        {valor}
      </p>
      <p className="text-sm text-tinta-suave">{que}</p>
      {valor > 0 && href && (
        <p className="mt-1 text-xs font-medium text-primary underline">resolver →</p>
      )}
    </div>
  );
  return href && valor > 0 ? <Link href={href}>{contenido}</Link> : contenido;
}
