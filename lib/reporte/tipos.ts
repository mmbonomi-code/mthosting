/**
 * Tipos compartidos del módulo Reporte.
 *
 * Viven acá y no en el archivo de acciones porque en un archivo `"use server"`
 * solo se pueden exportar funciones async: cualquier otra exportación rompe
 * el módulo entero en tiempo de ejecución.
 */

export type EstadoFormulario = { error: string } | { ok: string } | null;
