import { crearClienteServidor } from "@/lib/supabase/server";
import { traerTodo } from "@/lib/economico/consultar";
import ClasificarCuenta from "./ClasificarCuenta";

/**
 * Bandeja de cuentas de payout (spec §5.2 y §6.5).
 *
 * El importador da de alta cada destino nuevo que encuentra, pero NO clasifica
 * ninguno: decidir si una cuenta es de MTHosting o del propietario es lo que
 * define qué plata es ingreso propio y qué plata está solo de paso. Esa
 * decisión es humana.
 *
 * Clasificar aplica a todo el histórico sin reimportar: la clasificación se
 * lee en el momento de calcular, no se copia a cada movimiento.
 */
export default async function CuentasPayout() {
  const supabase = await crearClienteServidor();

  // El volumen se pagina. PostgREST devuelve 1000 filas como máximo y NO
  // avisa: sin esto, con el histórico entero cada cuenta mostraría el volumen
  // de las primeras mil y nada más. Y el volumen es justamente el dato con el
  // que se decide de quién es la cuenta, así que un número corto acá lleva a
  // clasificar mal, que es lo que define qué plata cuenta como ingreso.
  const movimientos = await traerTodo<{
    cuenta_id: string | null;
    importe: number | null;
    moneda: string;
  }>(
    () =>
      supabase
        .from("movimientos_economicos")
        .select("cuenta_id, importe, moneda")
        .eq("activo", true)
        .not("cuenta_id", "is", null) as never,
    "los pagos de cada cuenta",
  );

  const [{ data: cuentas }, { data: grafias }] = await Promise.all([
    supabase
      .from("cuentas_payout")
      .select("id, clave, titular, numero, tipo, moneda, clasificacion, notas")
      .eq("activo", true)
      .order("titular"),
    supabase.from("cuentas_payout_alias").select("cuenta_id, detalle_raw"),
  ]);

  // Las sin decidir van primero: son las que piden acción. Ordenar por el
  // nombre del estado las mandaba al fondo, que es donde no se miran.
  const PRIORIDAD = { sin_clasificar: 0, mth: 1, propietario: 2 } as const;
  const ordenadas = [...(cuentas ?? [])].sort(
    (a, b) =>
      (PRIORIDAD[a.clasificacion as keyof typeof PRIORIDAD] ?? 9) -
        (PRIORIDAD[b.clasificacion as keyof typeof PRIORIDAD] ?? 9) ||
      (a.titular ?? "").localeCompare(b.titular ?? ""),
  );

  const volumen = new Map<string, { filas: number; montos: Map<string, number> }>();
  for (const m of movimientos) {
    const actual = volumen.get(m.cuenta_id!) ?? { filas: 0, montos: new Map<string, number>() };
    actual.filas++;
    actual.montos.set(m.moneda, (actual.montos.get(m.moneda) ?? 0) + (m.importe ?? 0));
    volumen.set(m.cuenta_id!, actual);
  }

  const alias = new Map<string, string[]>();
  for (const a of grafias ?? []) {
    alias.set(a.cuenta_id, [...(alias.get(a.cuenta_id) ?? []), a.detalle_raw]);
  }

  const sinClasificar = ordenadas.filter(
    (c) => c.clasificacion === "sin_clasificar",
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-tinta">
          Cuentas de payout
        </h1>
        <p className="text-sm text-tinta-suave">
          Adónde va cada pago. Lo que entra a una cuenta de MTHosting puede ser
          ingreso propio; lo que va a una cuenta del propietario, no. Nada se
          clasifica solo.
        </p>
      </div>

      {sinClasificar > 0 && (
        <p className="rounded-md border border-borde border-l-[3px] border-l-accent bg-accent-soft px-4 py-3 text-sm font-medium text-accent-soft-text">
          Hay {sinClasificar} cuenta{sinClasificar === 1 ? "" : "s"} sin decidir. Mientras
          tanto no suma{sinClasificar === 1 ? "" : "n"} a lo percibido, así que los
          números van a quedar cortos hasta que las tildes.
        </p>
      )}

      {(ordenadas).length === 0 ? (
        <div className="rounded-md border border-borde bg-superficie px-6 py-12 text-center shadow-sm">
          <p className="text-tinta-suave">
            Todavía no se importó ningún pago, así que no hay cuentas detectadas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {ordenadas.map((c) => {
            const uso = volumen.get(c.id);
            const nombres = alias.get(c.id) ?? [];
            return (
              <li
                key={c.id}
                className={`flex flex-col gap-3 rounded-md border bg-superficie p-4 shadow-sm ${
                  c.clasificacion === "sin_clasificar"
                    ? "border-borde border-l-[3px] border-l-accent"
                    : "border-borde"
                }`}
              >
                <div>
                  <p className="font-semibold text-tinta">
                    {c.titular ?? "Sin titular"}
                    {c.numero && (
                      <span className="ml-2 font-mono font-normal text-tinta-suave">
                        ····{c.numero}
                      </span>
                    )}
                  </p>
                  <p className="text-sm tabular-nums text-tinta-suave">
                    {[c.tipo, c.moneda].filter(Boolean).join(" · ")}
                    {uso && (
                      <>
                        {c.tipo || c.moneda ? " · " : ""}
                        {uso.filas} pago{uso.filas === 1 ? "" : "s"} ·{" "}
                        {[...uso.montos]
                          .map(
                            ([moneda, monto]) =>
                              `${monto.toLocaleString("es-AR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} ${moneda}`,
                          )
                          .join(" · ")}
                      </>
                    )}
                  </p>
                  {/* Una misma cuenta aparece escrita de varias formas: se
                      muestran todas para poder reconocerla. */}
                  {nombres.length > 1 && (
                    <p className="mt-1 text-xs text-tinta-tenue">
                      Aparece como: {nombres.join(" · ")}
                    </p>
                  )}
                  {c.notas && <p className="mt-1 text-xs text-tinta-tenue">{c.notas}</p>}
                </div>
                <ClasificarCuenta cuentaId={c.id} actual={c.clasificacion} />
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
