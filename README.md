# MTHosting — Paquete de arranque

Este repositorio contiene **la especificación** del sistema de gestión de
MTHosting, lista para construirse con Claude Code. No contiene código todavía:
contiene todo lo necesario para que Claude Code lo escriba, paso por paso.

## Qué hay acá

```
CLAUDE.md                          Convenciones que Claude Code lee cada sesión
README.md                          Este archivo
docs/
  PLAN-FASES.md                    Las 4 fases y los 8 pasos de la Fase 1
  FASE-1-ESPECIFICACION.md         Modelo de datos y reglas de negocio (lo principal)
  FASE-2-VISTA-LIMPIEZA.md         La app mobile del personal de limpieza
  INFRAESTRUCTURA.md               Cuentas, entornos, deploy, backups
ejemplos/
  ejemplo-airbnb.ics               iCal real, para testear el parser (§2.12)
prototipo/
  MTHosting-Prototipo.html         Maqueta navegable de referencia visual
```

## Cómo se usa (orden recomendado)

1. **Crear las cuentas a tu nombre** desde el día cero: GitHub, Supabase,
   Vercel y el dominio. Están detalladas en `docs/INFRAESTRUCTURA.md`.
2. **Crear el repositorio** en GitHub y subir estos archivos a la raíz.
3. **Abrir el proyecto con Claude Code** en ese repositorio. Va a leer
   `CLAUDE.md` automáticamente.
4. **Arrancar por el Paso 0** del `PLAN-FASES.md` y avanzar de a un paso por
   vez. No pasar al siguiente sin ver el anterior funcionando.

## La regla de oro

Un paso por vez. La especificación es grande a propósito —para no tener que
tomar decisiones a mitad de camino— pero se construye de a poco. El orden de
los 8 pasos de Fase 1 está pensado para que cada uno deje algo verificable.

## El prototipo NO es el sistema

`prototipo/MTHosting-Prototipo.html` es una maqueta: datos inventados, nada se
guarda. Sirve como referencia de cómo se ven las pantallas y para mostrarle el
sistema al equipo. El sistema real se construye desde cero siguiendo las specs.
