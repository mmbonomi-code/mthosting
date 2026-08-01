"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/server";

/**
 * Bootstrap del primer uso: si todavía no existe NINGUNA persona en el
 * sistema, el usuario logueado puede crearse su ficha como admin.
 * Con una o más personas cargadas, esta acción no hace nada: las altas
 * siguientes las hace un admin desde la pantalla de usuarios (§3.7).
 */
export async function crearPrimerAdmin(formData: FormData) {
  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return;

  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { count } = await supabase
    .from("personas")
    .select("id", { count: "exact", head: true });
  if (count !== 0) return;

  await supabase.from("personas").insert({
    profile_id: user.id,
    nombre,
    rol: "admin",
    es_backoffice: true,
  });

  revalidatePath("/");
}
