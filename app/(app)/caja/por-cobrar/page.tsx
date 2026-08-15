import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { formatearFechaAR, hoyAR } from "@/lib/fechas";
import {
  deudaPorDepartamento,
  pesos,
  type Movimiento,
  type TipoMovimiento,
} from "@/lib/caja/saldo";
import { marcarCobrados } from "../acciones";
import CobroPorDepto from "./CobroPorDepto";
import SinAcceso from "../SinAcceso";

type Cruda = {
  id: string;
  fecha: string;
  tipo: string;
  monto: number;
  moneda: string;
  tc: number | null;
  descripcion: string | null;
  reembolsable: boolean;
  fecha_cobro: string | null;
  forma_cobro: string | null;
  categoria: { id: string; nombre: string } | null;
  depto: { id: string; codigo: string } | null;
};

/**
 * Lo que deben los propietarios, agrupado por departamento. Es como se cobra
 * en la práctica: "estos cuatro de Arenales 5, transferencia del 15".
 */
export default async function PorCobrar() {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCaja(supabase))) return <SinAcceso />;

  const { data: crudos } = await supabase
    .from("movimientos_caja")
    .select(
      `id, fecha, tipo, monto, moneda, tc, descripcion, reembolsable,
       fecha_cobro, forma_cobro,
       categoria:categorias_movimiento(id, nombre),
       depto:departamentos(id, codigo)`,
    )
    .eq("activo", true)
    .eq("reembolsable", true)
    .is("fecha_cobro", null)
    .order("fecha");

  const movimientos: Movimiento[] = ((crudos ?? []) as unknown as Cruda[]).map((m) => ({
    id: m.id,
    fecha: m.fecha,
    tipo: m.tipo as TipoMovimiento,
    monto: m.monto,
    moneda: m.moneda,
    tc: m.tc,
    descripcion: m.descripcion,
    categoria_id: m.categoria?.id ?? null,
    categoria_nombre: m.categoria?.nombre ?? null,
    depto_id: m.depto?.id ?? null,
    depto_codigo: m.depto?.codigo ?? null,
    reembolsable: m.reembolsable,
    fecha_cobro: m.fecha_cobro,
    forma_cobro: m.forma_cobro,
  }));

  const deuda = deudaPorDepartamento(movimientos);
  const total = deuda.reduce((s, d) => s + d.total, 0);
  const hoy = hoyAR();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/caja" className="text-sm text-tinta-suave hover:text-tinta">
        ← Volver a la caja
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-tinta">Por cobrar</h1>
        <p className="text-sm text-tinta-suave">
          Gastos que puso MTHosting y el propietario tiene que devolver.
        </p>
      </div>

      {deuda.length === 0 ? (
        <div className="rounded-md border border-borde bg-superficie px-6 py-12 text-center">
          <p className="text-tinta-suave">No hay nada pendiente de cobro.</p>
        </div>
      ) : (
        <>
          <section className="rounded-md border border-aviso/60 bg-aviso-soft/30 p-4">
            <span className="text-xs uppercase tracking-wide text-aviso-text">
              Total pendiente
            </span>
            <p className="text-3xl font-semibold tabular-nums text-aviso-text">
              {pesos(total)}
            </p>
            <p className="text-xs text-aviso-text/80">
              {movimientos.length} movimiento{movimientos.length === 1 ? "" : "s"} en{" "}
              {deuda.length} departamento{deuda.length === 1 ? "" : "s"}
            </p>
          </section>

          <ul className="flex flex-col gap-3">
            {deuda.map((d) => (
              <CobroPorDepto
                key={d.depto_id}
                deuda={d}
                movimientos={movimientos
                  .filter((m) => m.depto_id === d.depto_id)
                  .map((m) => ({
                    id: m.id,
                    fecha: formatearFechaAR(m.fecha),
                    categoria: m.categoria_nombre ?? "Sin categoría",
                    descripcion: m.descripcion,
                    monto: pesos(m.monto),
                  }))}
                totalTexto={pesos(d.total)}
                desdeTexto={formatearFechaAR(d.desde)}
                hoy={hoy}
                cobrar={async (_previo, fd) => {
                  "use server";
                  return marcarCobrados(fd);
                }}
              />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
