# MTHosting — Plan de fases

## Objetivo del sistema

Que MTHosting opere sin la intervención del dueño. La operación está delegada
en la manager (Maguie); el sistema debe generar y alertar todo lo que hoy
depende de que alguien se acuerde.

El proyecto es una **migración desde Ninox**, no un desarrollo desde cero.
Ninox se reemplaza por tres carencias concretas: no tiene usuarios ni
permisos, no tiene fotos, y no tiene vista mobile para el personal de
limpieza.

## Fases

| Fase | Alcance | Criterio de cierre |
|---|---|---|
| **1 — Núcleo** | Departamentos, importador de reservas de Airbnb, generación automática de limpiezas, coordinación de check-in/check-out (mobile-first), asignación de limpiezas (mobile-first), resumen semanal, vista de distribución para gobernanta, alertas, export PDF diario, exportables de contactos, sincronización iCal, importación de puntajes de calidad | **Ninox apagado** para reservas, limpiezas y check-ins. El equipo de back office trabaja solo en el sistema nuevo. Las limpiadoras siguen recibiendo el PDF por WhatsApp: nada cambia para ellas |
| **2 — Vista mobile** | PWA para el personal de limpieza: sus limpiezas asignadas, instrucciones de acceso, checklist, fotos con compresión, faltantes, alta de arreglos, viáticos con comprobante, acumulado del período. Endurecimiento de RLS por rol | Una limpiadora real completa una limpieza de punta a punta sin ayuda, y el grupo la adopta como canal principal |
| **3 — Operación extendida** | Arreglos con prestadores, reportes de turno con historial, reclamos con alerta de ventana de 14 días de Airbnb, bloqueos de calendario completos | Los arreglos y reportes dejan de circular por WhatsApp |
| **4 — Financiero** | Gastos con cuentas, cotizaciones USD, liquidación mensual a propietarios, pagos al personal (limpiezas + pago doble + viáticos), dashboard | El cierre mensual sale del sistema sin planillas paralelas |

## Decisiones de alcance ya cerradas

- **CHECK LIST NOCHE** de Ninox se descarta: no existe en el sistema nuevo.
- **GASTOS (VIEJO)** no se migra.
- **Check-in/out y asignación de limpiezas se diseñan mobile-first.** La
  importación es solo escritorio.
- **No hay editor de permisos configurable.** Cinco roles definidos en código;
  la pantalla de usuarios asigna uno de ellos.

## Reglas del plan

1. **La Fase 1 no está terminada hasta que Ninox esté apagado** para sus
   funciones. Dos sistemas conviviendo "por las dudas" significa mantener dos
   sistemas para siempre.
2. **Antes de arrancar la Fase 1 se fija una fecha objetivo para la Fase 2**
   (completar: ____ / ____ / ____). La vista mobile es la razón por la que
   este proyecto existe; es exactamente lo que se posterga cuando aparece
   otra prioridad.
3. **El dashboard va siempre al final.** Consume datos de todo lo demás.
4. La validadora del sistema es la manager, no el dueño. Cada fase se cierra
   con ella usándolo.

## Prototipo descartable (paralelo, opcional)

Antes o durante la Fase 1: prototipo de la vista mobile de limpieza, sin base
de datos, con datos falsos. Se prueba con una limpiadora real. Objetivo:
validar la adopción —el mayor riesgo del proyecto— antes de construir la
Fase 2. Si compite por tiempo con la Fase 1, se descarta: la Fase 1 gana.

## Orden de construcción de la Fase 1

| # | Paso | Entregable verificable |
|---|---|---|
| 1 | Setup + esquema completo | Repo, Supabase dev/prod, deploy vacío en Vercel, migración inicial con TODAS las tablas |
| 2 | Auth básica | Login funcionando, tabla `personas`, RLS simple |
| 3 | Departamentos | CRUD + los 50+ departamentos reales migrados desde Ninox |
| 4 | Importador | CSV real importado; re-importarlo no cambia nada |
| 5 | Bandeja sin asignar | Anuncio nuevo → mapeo manual una vez → nunca más pregunta |
| 6 | Generación de limpiezas | Al importar, las limpiezas de la semana aparecen solas |
| 7 | Vista check-in/out | Coordinación del día con selector unificado de responsable |
| 8 | Asignación + exports | Pantalla de asignación (7 días en escritorio, día único + resumen semanal, vista de distribución para gobernanta en celular), PDF del día siguiente y los dos exportables de contactos |

El importador (pasos 4–6) es la mitad del esfuerzo de la fase. Es la pieza
con más reglas y donde un bug corrompe datos en silencio.
