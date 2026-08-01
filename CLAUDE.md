# MTHosting — Sistema de gestión

Sistema de gestión operativa para MTHosting: co-hosting de alquiler temporario
(50+ departamentos en CABA, reservas de Airbnb). Reemplaza un sistema existente
en Ninox. El plan completo está en `docs/PLAN-FASES.md`; la especificación de la
fase actual en `docs/FASE-1-ESPECIFICACION.md`. Leer ambos antes de construir.

## Stack

- Next.js (App Router) + TypeScript
- Supabase: Postgres, Auth, Storage
- Vercel para deploy. PWA instalable desde el inicio.
- UI en español (es-AR). Identificadores de código y DB en español, snake_case,
  sin tildes ni eñes (`ninos`, no `niños`).

## Reglas de datos — NO negociables

1. **Fechas de negocio** (check-in, check-out, limpieza) son `date`, NUNCA
   `timestamptz`. Un check-in es "el día 19", no un instante. La zona horaria
   de negocio es `America/Argentina/Buenos_Aires`, fija. "Hoy" y "mañana" se
   calculan SIEMPRE con una utilidad central en esa zona (`lib/fechas.ts`),
   nunca con `new Date()` pelado, ni en server ni en client.
2. **Dinero**: `monto numeric` + `moneda text`. Si hay conversión, se guarda
   `tc` y `fecha_tc`. Nunca un número suelto sin moneda.
3. **Bajas lógicas**: campo `activo boolean`. PROHIBIDO el DELETE físico sobre
   datos operativos.
4. **Nunca sobrescribir un valor existente con uno vacío.** Regla general del
   importador y de cualquier update masivo.
5. **Snapshot de tarifas**: al asignar una limpieza, el monto se copia a
   `monto_pactado` y no se recalcula jamás. Las tarifas se versionan por fecha
   (`vigente_desde` / `vigente_hasta`), nunca se hace UPDATE del monto.
6. **`listing_alias`**: el nombre del anuncio de Airbnb NUNCA es clave de nada.
   El mapeo anuncio→departamento vive en `listing_alias`.
7. **Auditoría**: trigger genérico `audit_log` sobre las tablas operativas
   desde la primera migración.

## Esquema y migraciones

- El esquema se modifica ÚNICAMENTE con archivos SQL en `supabase/migrations/`,
  aplicados con la CLI. PROHIBIDO tocar el esquema desde el panel de Supabase.
- La migración inicial crea TODAS las tablas de la especificación, incluidas
  las que no tienen UI en Fase 1 (gastos, liquidaciones, etc.).
- Índices desde el inicio en: `reservas.codigo_reserva` (unique),
  `limpiezas (depto_id, fecha)`, `limpiezas.estado`,
  `eventos_estadia (fecha, tipo)`, `reservas (depto_id, fecha_checkin)`.
- PROHIBIDO el patrón "recorrer toda la tabla por cada fila" (el saldo
  acumulado O(n²) de Ninox es el anti-ejemplo). Agregaciones con window
  functions o queries agregadas.
- Listados siempre paginados.

## Seguridad

- RLS activada en todas las tablas. En Fase 1 la política es simple: solo
  usuarios autenticados, nada para `anon`. Las políticas finas por rol se
  endurecen en Fase 2, antes de que entre el personal de limpieza.
- `service_role` key SOLO en server. Jamás en el cliente ni en el repo.
- Secretos en `.env.local` (gitignored) y en las env vars de Vercel.
- Credenciales de Airbnb de propietarios: cifradas, visibles solo por admin.

## Diseño responsive

- **Check-in/out y asignación de limpiezas: mobile-first.** Se usan desde la
  calle. En celular el uso dominante es CONSULTAR (buscador arriba, datos del
  depto a un toque, tap-to-call), no cargar.
- **Importación: solo escritorio.** No se optimiza para celular.
- Exportables de contactos: la columna de teléfono se escribe como TEXTO en el
  xlsx, nunca como número (se convierte en notación científica y rompe el
  archivo).

## Prohibido

- `localStorage` / `sessionStorage` para datos de negocio.
- Sobre-ingeniería: sin microservicios, sin colas, sin caché prematura. La
  escala es chica (miles de filas por año); Postgres bien indexado alcanza.
- Auto-asignar limpiezas o pre-seleccionar responsables. El sistema propone
  información, la asignación es siempre una decisión humana explícita.
- Editor de permisos configurable. Cinco roles definidos en código.
- Borrar limpiezas o reservas. Todo pasa a estado `cancelada`.
- Librerías abandonadas o exóticas. Preferir lo estándar y mantenido.

## Forma de trabajo

- Una funcionalidad por sesión. Commit cada vez que algo queda funcionando.
- Tests obligatorios para el parser del importador: fechas en ambos formatos,
  Ganancias con coma y con punto decimal, montos > 1000, preservación de
  vacíos, idempotencia del upsert.
- Ante ambigüedad en una regla de negocio: preguntar, no asumir. Las reglas
  están en `docs/FASE-1-ESPECIFICACION.md`.
