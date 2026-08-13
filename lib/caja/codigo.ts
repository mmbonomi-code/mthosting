/**
 * Código para entrar a la caja (decisión del dueño, 12/08/2026).
 *
 * Es una CORTINA, no una cerradura: evita que alguien que pasa por al lado
 * de la pantalla —o que agarra la sesión abierta— vea la plata de un
 * vistazo. Quien tenga el usuario de manager o de administración ya tiene
 * acceso a esos datos por otros caminos; lo que esto agrega es una pausa
 * deliberada antes de mostrarlos.
 *
 * El código NO vive en el código fuente: sale de la variable de entorno
 * `CAJA_CODIGO`, igual que cualquier otro secreto. Un número guardado en el
 * repositorio lo puede leer cualquiera que vea el proyecto, y cambiarlo
 * obligaría a publicar una versión nueva.
 *
 * Si la variable no está cargada, la caja no pide nada: es preferible a
 * dejar afuera a quien tiene que entrar por una configuración que falta.
 */

import { cookies } from "next/headers";

/** Nombre de la cookie que recuerda que ya se puso el código. */
const COOKIE = "caja_abierta";

/**
 * Cuánto dura sin volver a pedirlo (decisión del dueño, 12/08/2026).
 *
 * Una hora: el tiempo de sentarse a hacer caja. Después vuelve a pedirlo,
 * así una sesión olvidada abierta no deja la plata a la vista toda la tarde.
 */
const HORAS = 1;

export function codigoConfigurado(): boolean {
  return (process.env.CAJA_CODIGO ?? "").trim() !== "";
}

export function codigoEsCorrecto(valor: string): boolean {
  const esperado = (process.env.CAJA_CODIGO ?? "").trim();
  if (esperado === "") return false;
  return valor.trim() === esperado;
}

/** ¿Ya puso el código en esta sesión? */
export async function cajaDesbloqueada(): Promise<boolean> {
  if (!codigoConfigurado()) return true;
  const galletas = await cookies();
  return galletas.get(COOKIE)?.value === "1";
}

export async function abrirCaja(): Promise<void> {
  const galletas = await cookies();
  galletas.set(COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: HORAS * 60 * 60,
  });
}

export async function cerrarCaja(): Promise<void> {
  const galletas = await cookies();
  galletas.delete(COOKIE);
}
