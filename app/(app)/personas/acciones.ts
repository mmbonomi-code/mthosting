"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { esManagerOAdmin } from "@/lib/permisos";
import type { Database } from "@/lib/database.types";

type ModalidadPago = Database["public"]["Enums"]["modalidad_pago"];
type Rol = Database["public"]["Enums"]["rol_usuario"];

export type EstadoFormulario = { error: string } | null;

function texto(fd: FormData, campo: string): string | null {
  const valor = String(fd.get(campo) ?? "").trim();
  return valor === "" ? null : valor;
}

function datosPersona(fd: FormData) {
  return {
    nombre: String(fd.get("nombre") ?? "").trim(),
    telefono: texto(fd, "telefono"),
    hace_limpieza: fd.get("hace_limpieza") === "on",
    hace_checkin: fd.get("hace_checkin") === "on",
    // `es_backoffice` ya no se escribe: el permiso sale del rol. La columna
    // queda con sus valores, no se pisa con vacío (CLAUDE.md, regla 4).
    modalidad_pago: texto(fd, "modalidad_pago") as ModalidadPago | null,
    rol: texto(fd, "rol") as Rol | null,
    activo: fd.get("activo") === "on",
  };
}

export async function crearPersona(
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPersona(fd);
  if (!datos.nombre) return { error: "El nombre es obligatorio." };

  const supabase = await crearClienteServidor();
  // La pantalla ya está cerrada, pero una acción se puede llamar sin pasar
  // por ella: el control va también acá.
  if (!(await esManagerOAdmin(supabase))) {
    return { error: "Solo manager y administración pueden cargar personas." };
  }

  const { error } = await supabase.from("personas").insert(datos);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/personas");
  redirect("/personas");
}

export async function actualizarPersona(
  id: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const datos = datosPersona(fd);
  if (!datos.nombre) return { error: "El nombre es obligatorio." };

  const supabase = await crearClienteServidor();
  if (!(await esManagerOAdmin(supabase))) {
    return { error: "Solo manager y administración pueden editar personas." };
  }

  const { error } = await supabase.from("personas").update(datos).eq("id", id);
  if (error) return { error: "No se pudo guardar. Probá de nuevo." };

  revalidatePath("/personas");
  redirect("/personas");
}

// --- Acceso al sistema -------------------------------------------------------

/** Crear usuarios es exclusivo de administración (spec §3.8). */
async function esAdmin(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: persona } = await supabase
    .from("personas")
    .select("rol")
    .eq("profile_id", user.id)
    .maybeSingle();
  return persona?.rol === "admin";
}

/**
 * Le da acceso a la app a una persona: crea su usuario y lo vincula a su
 * ficha. Lo necesitan las limpiadoras y la gobernanta, que van a usar el
 * módulo de limpieza en la Fase 2.
 */
export async function darAcceso(
  personaId: string,
  _estadoPrevio: EstadoFormulario,
  fd: FormData,
): Promise<EstadoFormulario> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá el email y una contraseña inicial." };
  }
  if (password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  }

  const supabase = await crearClienteServidor();
  if (!(await esAdmin(supabase))) {
    return { error: "Solo administración puede crear usuarios." };
  }

  const admin = crearClienteAdmin();
  if (!admin) {
    return {
      error:
        "Falta configurar la clave de servidor (SUPABASE_SERVICE_ROLE_KEY) en Vercel.",
    };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    if (/already/i.test(error.message)) {
      return { error: "Ya existe un usuario con ese email." };
    }
    return { error: `No se pudo crear el usuario: ${error.message}` };
  }

  const { error: errorVinculo } = await supabase
    .from("personas")
    .update({ profile_id: data.user.id })
    .eq("id", personaId);
  if (errorVinculo) {
    return { error: "El usuario se creó pero no se pudo vincular a la persona." };
  }

  revalidatePath(`/personas/${personaId}/editar`);
  revalidatePath("/personas");
  return null;
}

export type EstadoClave = { error: string } | { ok: string } | null;

/**
 * Reinicia la contraseña de una persona que ya tiene usuario.
 *
 * La app no manda mails, así que no hay "olvidé mi contraseña": cuando
 * alguien pierde la suya, administración le pone una nueva y se la pasa. La
 * persona puede seguir usándola o cambiarla después.
 */
export async function reiniciarClave(
  personaId: string,
  _estadoPrevio: EstadoClave,
  fd: FormData,
): Promise<EstadoClave> {
  const password = String(fd.get("password") ?? "");
  if (password.length < 8) {
    return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  }

  const supabase = await crearClienteServidor();
  if (!(await esAdmin(supabase))) {
    return { error: "Solo administración puede reiniciar contraseñas." };
  }

  const { data: persona } = await supabase
    .from("personas")
    .select("nombre, profile_id")
    .eq("id", personaId)
    .maybeSingle();

  if (!persona?.profile_id) {
    return { error: "Esta persona todavía no tiene usuario." };
  }

  const admin = crearClienteAdmin();
  if (!admin) {
    return {
      error:
        "Falta configurar la clave de servidor (SUPABASE_SERVICE_ROLE_KEY) en Vercel.",
    };
  }

  const { error } = await admin.auth.admin.updateUserById(persona.profile_id, {
    password,
  });
  if (error) {
    return { error: `No se pudo cambiar la contraseña: ${error.message}` };
  }

  return { ok: `Contraseña nueva lista. Pasásela a ${persona.nombre}.` };
}

/**
 * Le saca el acceso: la ficha se desvincula del usuario. El usuario no se
 * borra (nada se borra), simplemente deja de estar asociado.
 */
export async function quitarAcceso(personaId: string) {
  const supabase = await crearClienteServidor();
  if (!(await esAdmin(supabase))) return;

  await supabase.from("personas").update({ profile_id: null }).eq("id", personaId);
  revalidatePath(`/personas/${personaId}/editar`);
  revalidatePath("/personas");
}
