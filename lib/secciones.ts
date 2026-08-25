/**
 * Qué secciones de la app puede abrir cada rol (spec §3.8).
 *
 * Funciones PURAS, sin base de datos: reciben el rol y una ruta y contestan.
 * Las usan dos lugares y tienen que dar lo mismo en los dos:
 *
 *  - `proxy.ts`, que es el que de verdad impide entrar. Ahí se corta antes de
 *    que la pantalla se arme, así que no alcanza con esconder el enlace.
 *  - El menú de `app/(app)/layout.tsx`, que no ofrece lo que no se puede
 *    abrir. Esconder sin cerrar es maquillaje; cerrar sin esconder deja
 *    botones que dan error.
 *
 * REGLA DE ARRANQUE: un rol que no figura acá NO tiene límite. Se restringe
 * solo lo que está escrito. Es a propósito: agregar un rol a la lista es una
 * decisión explícita, y equivocarse dejando a alguien afuera de su trabajo es
 * peor que dejarlo ver de más un tiempo más.
 *
 * Los permisos que ya están resueltos en su propio módulo —caja, reclamos,
 * reporte, reservas— siguen ahí. Esto es la capa de "qué pantallas existen
 * para vos", no la de "qué podés hacer adentro".
 */

import type { Database } from "@/lib/database.types";

export type Rol = Database["public"]["Enums"]["rol_usuario"];

type Acceso = {
  /** A dónde va cuando entra, y a dónde se lo manda si pide algo que no puede. */
  inicio: string;
  /** Prefijos de ruta permitidos. `/semana` abre `/semana` y `/semana/loquesea`. */
  prefijos: readonly string[];
  /** Excepciones adentro de lo permitido: ve la pantalla pero no la edita. */
  vedadas?: readonly RegExp[];
};

const ACCESO: Partial<Record<Rol, Acceso>> = {
  /**
   * Gobernanta: reparte el trabajo de limpieza y consulta las fichas de los
   * departamentos. Nada más (decisión del dueño, 13/08/2026).
   *
   * No ve check-in/out, ni reservas, ni la caja, ni la configuración: su
   * trabajo es repartir carga de limpieza de forma equitativa.
   *
   * Las fichas de departamento las CONSULTA. Crear y editar es de manager y
   * administración, así que el alta, la edición y el inventario quedan
   * afuera aunque cuelguen de una ruta permitida.
   */
  gobernanta: {
    inicio: "/semana",
    prefijos: [
      "/semana",
      "/limpiezas",
      "/departamentos",
      // La gobernanta también tiene sus propias limpiezas: reparte Y ejecuta
      // (spec §2.10.bis, "el rol gobernanta es un híbrido").
      "/mis-limpiezas",
      // Emitir el PDF del día es parte de repartir el trabajo.
      "/api/exportar/limpiezas-pdf",
      "/api/exportar/limpiezas-rango",
    ],
    vedadas: [/^\/departamentos\/nuevo$/, /\/editar$/, /\/equipamiento$/],
  },
};

/** Dónde aterriza al entrar. Sin restricción, la pantalla de inicio. */
export function inicioDelRol(rol: Rol | null): string {
  return (rol && ACCESO[rol]?.inicio) || "/";
}

/** ¿Este rol puede abrir esta ruta? */
export function puedeEntrar(rol: Rol | null, ruta: string): boolean {
  // Sin rol no hay restricción: es el caso del primer uso del sistema, cuando
  // todavía no existe ninguna ficha y hay que poder crear la de admin.
  if (rol === null) return true;

  const acceso = ACCESO[rol];
  if (acceso === undefined) return true;

  if (acceso.vedadas?.some((v) => v.test(ruta))) return false;

  return acceso.prefijos.some(
    (p) => ruta === p || ruta.startsWith(`${p}/`),
  );
}

/** ¿Tiene el menú recortado? Sirve para explicarlo en pantalla. */
export function tieneAccesoLimitado(rol: Rol | null): boolean {
  return rol !== null && ACCESO[rol] !== undefined;
}
