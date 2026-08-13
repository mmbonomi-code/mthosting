import { crearClienteServidor } from "@/lib/supabase/server";
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

  const [{ data: cuentas }, { data: movimientos }, { data: grafias }] = await Promise.all([
    supabase
      .from("cuentas_payout")
      .select("id, clave, titular, numero, tipo, moneda, clasificacion, notas")
      .eq("activo", true)
      .order("clasificacion")
      .order("titular"),
    supabase
      .from("movimientos_economicos")
      .select("cuenta_id, importe, moneda")
      .eq("activo", true)
      .not("cuenta_id", "is", null),
    supabase.from("cuentas_payout_alias").select("cuenta_id, detalle_raw"),
  ]);

  const volumen = new Map<string, { filas: number; montos: Map<string, number> }>();
  for (const m of movimientos ?? []) {
    const actual = volumen.get(m.cuenta_id!) ?? { filas: 0, montos: new Map<string, number>() };
    actual.filas++;
    actual.montos.set(m.moneda, (actual.montos.get(m.moneda) ?? 0) + (m.importe ?? 0));
    volumen.set(m.cuenta_id!, actual);
  }

  const alias = new Map<string, string[]>();
  for (const a of grafias ?? []) {
    alias.set(a.cuenta_id, [...(alias.get(a.cuenta_id) ?? []), a.detalle_raw]);
  }

  const sinClasificar = (cuentas ?? []).filter(
    (c) => c.clasificacion === "sin_clasificar",
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          Cuentas de payout
        </h1>
        <p className="text-sm text-slate-400">
          Adónde va cada pago. Lo que entra a una cuenta de MTHosting puede ser
          ingreso propio; lo que va a una cuenta del propietario, no. Nada se
          clasifica solo.
        </p>
      </div>

      {sinClasificar > 0 && (
        <p className="rounded-lg bg-amber-950/40 px-4 py-3 text-sm text-amber-200">
          Hay {sinClasificar} cuenta{sinClasificar === 1 ? "" : "s"} sin decidir. Mientras
          tanto no suma{sinClasificar === 1 ? "" : "n"} a lo percibido, así que los
          números van a quedar cortos hasta que las tildes.
        </p>
      )}

      {(cuentas ?? []).length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 px-6 py-12 text-center">
          <p className="text-slate-300">
            Todavía no se importó ningún pago, así que no hay cuentas detectadas.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {(cuentas ?? []).map((c) => {
            const uso = volumen.get(c.id);
            const nombres = alias.get(c.id) ?? [];
            return (
              <li
                key={c.id}
                className={`flex flex-col gap-3 rounded-xl border bg-slate-800/40 p-4 ${
                  c.clasificacion === "sin_clasificar"
                    ? "border-amber-900/60"
                    : "border-slate-800"
                }`}
              >
                <div>
                  <p className="font-medium text-slate-100">
                    {c.titular ?? "Sin titular"}
                    {c.numero && (
                      <span className="ml-2 font-normal text-slate-400">
                        ····{c.numero}
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">
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
                    <p className="mt-1 text-xs text-slate-600">
                      Aparece como: {nombres.join(" · ")}
                    </p>
                  )}
                  {c.notas && <p className="mt-1 text-xs text-slate-500">{c.notas}</p>}
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
