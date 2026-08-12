import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { puedeVerCaja } from "@/lib/caja/permisos";
import { hoyAR } from "@/lib/fechas";
import { crearMovimiento } from "../acciones";
import FormularioMovimiento from "../FormularioMovimiento";
import SinAcceso from "../SinAcceso";

export default async function NuevoMovimiento() {
  const supabase = await crearClienteServidor();
  if (!(await puedeVerCaja(supabase))) return <SinAcceso />;

  const [{ data: categorias }, { data: departamentos }, { data: cotizacionHoy }] =
    await Promise.all([
      supabase
        .from("categorias_movimiento")
        .select("id, nombre, es_cambio")
        .eq("activo", true)
        .order("nombre"),
      supabase
        .from("departamentos")
        .select("id, codigo")
        .eq("estado", "activo")
        .order("codigo"),
      supabase.from("cotizaciones").select("tc").eq("fecha", hoyAR()).maybeSingle(),
    ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6 sm:px-6">
      <Link href="/caja" className="text-sm text-slate-400 hover:text-white">
        ← Volver a la caja
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight text-white">
        Nuevo movimiento
      </h1>

      {!cotizacionHoy && (
        <p className="rounded-lg bg-slate-800/60 px-4 py-3 text-sm text-slate-400">
          Todavía no cargaste la cotización de hoy. El movimiento se guarda igual;
          el valor en dólares aparece cuando la cargues en{" "}
          <Link href="/caja/cotizaciones" className="underline underline-offset-4">
            Cotizaciones
          </Link>
          .
        </p>
      )}

      <FormularioMovimiento
        accion={async (_previo, fd) => {
          "use server";
          return crearMovimiento(fd);
        }}
        valores={{
          fecha: hoyAR(),
          tipo: "egreso",
          monto: "",
          categoria_id: "",
          depto_id: "",
          descripcion: "",
          reembolsable: false,
          usd_cambiado: "",
          tc_cambio: "",
        }}
        categorias={categorias ?? []}
        departamentos={departamentos ?? []}
        esAlta
        urlCancelar="/caja"
      />
    </main>
  );
}
