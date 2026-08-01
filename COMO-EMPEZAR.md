# Cómo empezar con Claude Code

Guía para arrancar el desarrollo de MTHosting. Seguí los pasos en orden.

---

## Antes de tocar Claude Code: las cuentas

Todo a tu nombre, con tu mail, desde el día cero.

- [ ] **GitHub** (github.com): cuenta + un repositorio nuevo, **vacío y
      privado**, llamado `mthosting`.
- [ ] **Supabase** (supabase.com): cuenta + un proyecto nuevo. Guardá en un
      lugar seguro las claves que te da (URL del proyecto y las API keys).
- [ ] **Vercel** (vercel.com): cuenta, entrando con tu GitHub.
- [ ] **Dominio**: opcional, puede esperar. No hace falta para arrancar.

Los detalles de cada cuenta están en `docs/INFRAESTRUCTURA.md`.

---

## Paso 1 — Poner el proyecto en tu computadora

1. En GitHub, en tu repo `mthosting` vacío, copiá la dirección para clonar
   (botón verde "Code" → HTTPS).
2. Cloná el repo a una carpeta de tu compu. Si no sabés cómo, en el Paso 3 se
   lo podés pedir a Claude Code directamente.
3. Descomprimí este ZIP y copiá **todo su contenido** dentro de esa carpeta:
   `CLAUDE.md`, `README.md`, `COMO-EMPEZAR.md`, `docs/`, `ejemplos/`,
   `prototipo/`.

---

## Paso 2 — Elegir el modelo

En Claude Code, con el comando `/model` elegís qué modelo usar. Para toda la
Fase 1 usá **el más capaz disponible**. El importador y el modelo de datos no
son lugar para ahorrar: un modelo más flojo mete errores sutiles difíciles de
encontrar.

---

## Paso 3 — Abrir el proyecto y el primer mensaje

1. Abrí la app de Claude Code y, en la pestaña **Code**, abrí la carpeta del
   proyecto (la que tiene el `CLAUDE.md`).
2. Verificá con `/model` que estás en el modelo más capaz.
3. Escribí este primer mensaje, tal cual:

> Leé el README.md, el COMO-EMPEZAR.md y todos los archivos de docs/. Vamos a
> construir esto de a un paso por vez, empezando por el Paso 0 del
> PLAN-FASES.md. No avances al paso siguiente sin que yo lo confirme.
> Antes de escribir nada de código, contame en palabras simples qué vas a
> hacer en el Paso 0 y qué cuentas o datos vas a necesitar de mí.

---

## Las reglas de oro (leer antes de arrancar)

1. **Un paso por vez.** No pidas "hacé toda la Fase 1". El valor de los 8 pasos
   es poder frenar, revisar y corregir en cada uno. Si le pedís todo junto y
   algo falla, no vas a saber dónde.

2. **Revisá antes de aprobar.** Claude Code pregunta antes de modificar
   archivos. Sobre todo al principio, leé lo que propone antes de decir que sí.
   Si no entendés algo, pedile que te lo explique en palabras simples.

3. **Git desde el día cero.** Es la red de seguridad: cada cambio queda
   registrado y se puede volver atrás. Que el Paso 0 deje esto funcionando.

4. **Empezá con calma.** El Paso 0 (setup y deploy vacío) es de bajo riesgo, a
   propósito: te deja ver cómo trabaja Claude Code antes de meterse con lo
   pesado. Usá esa primera etapa para agarrarle la mano.

5. **Deploy desde el día 1.** Que la app —aunque esté vacía— se publique en
   Vercel desde el Paso 0. Es más fácil mantener algo publicado que publicar
   algo grande al final.

---

## Cosas que Claude Code te va a preguntar (es normal)

- Decisiones que la spec no cubre ("encontré un dato raro, ¿qué hago?").
- Confirmación antes de algo irreversible ("voy a correr esta migración").
- Cosas que solo vos podés hacer ("¿ya creaste la cuenta de Supabase?").

Cuando no entiendas una pregunta, pedile las opciones antes de elegir. No le
digas que sí a algo que no entendiste.

---

## Si algo se rompe

- `/doctor` en Claude Code revisa la instalación y avisa si hay algún problema.
- Como todo está en Git, siempre se puede volver al último punto que
  funcionaba. Si algo quedó mal, decíselo: "esto se rompió, volvamos al último
  commit que funcionaba".

---

## El orden de la Fase 1 (resumen)

Del `docs/PLAN-FASES.md`:

0. Setup + esquema completo + deploy vacío
1. Acceso (login)
2. Departamentos
3. Importador de reservas  ← la mitad del esfuerzo, la parte más delicada
4. Bandeja de reservas sin asignar
5. Generación de limpiezas
6. Check-in / check-out
7. Asignación + exportables

Cada paso deja algo que se puede ver funcionando. No se avanza sin eso.
