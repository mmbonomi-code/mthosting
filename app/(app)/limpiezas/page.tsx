import { redirect } from "next/navigation";

/**
 * El listado de limpiezas vive en /semana: una sola pantalla con la semana
 * de un vistazo y el detalle de cada día. Se mantiene esta ruta porque
 * varias pantallas y enlaces viejos apuntan acá.
 */
export default async function Limpiezas({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; dias?: string }>;
}) {
  const { desde, dias } = await searchParams;
  const qs = new URLSearchParams();
  if (desde) qs.set("desde", desde);
  if (dias) qs.set("dias", dias);
  redirect(qs.size > 0 ? `/semana?${qs}` : "/semana");
}
