# Módulo Reclamos — Especificación

Sistema: MTHosting PMS · Next.js (App Router) + TypeScript + Supabase + Vercel · PWA
UI en español (es-AR) · Timezone `America/Argentina/Buenos_Aires`

## 0. Cómo leer este documento (para Claude Code)

Las secciones 1, 2, 4, 5, 6 y 7 son **decisiones tomadas**: respetalas tal cual.

La sección 3 (esquema) es **referencia, no literal**. Este documento se escribió sin ver el
schema del proyecto. Antes de crear nada, leé `supabase/migrations/` y adaptá los nombres de
tablas, columnas y convenciones a los que ya existen. Los campos que importan son los que están,
no cómo se llaman acá. Si algo que este documento asume no existe en el proyecto, decilo en vez
de crearlo por tu cuenta.

## 1. Qué resuelve

Registrar los daños causados por huéspedes que hay que reclamar a Airbnb, con la evidencia
fotográfica, y avisar antes de que se venza el plazo para presentarlos.

Quien carga el reclamo es Maguie (ops), a partir de las fotos que subió la limpieza.
La limpieza **no** carga reclamos ni ve montos.

## 2. Reglas de negocio

**Un reclamo por reserva.** Constraint único sobre `reserva_id`. Si una reserva tiene varios
daños, van todos en el mismo reclamo (motivo libre + monto total).

**Plazos (sobre la fecha de check-out, medidos en hora de Buenos Aires):**

| Plazo | Días desde check-out | Aplica a |
|---|---|---|
| Presentar en el Centro de resoluciones | 14 | estados `borrador`, `por_presentar` |
| Escalar a AirCover (formulario de solicitud de pago) | 30 | estado `presentado` (el huésped no pagó) |

Fuente: Airbnb, Términos de la Protección contra Daños para Anfitriones (art. 2869, secciones
3.1.2 y 3.3) y Centro de ayuda art. 279. No existe una regla escrita de "antes de que entre el
próximo huésped" — **no implementarla**.

**Moneda:** todo en USD. Un solo campo de monto, sin conversión ni tipo de cambio.

**Alerta de vencimiento:** contar los reclamos cuyo plazo aplicable vence en los próximos 3 días
(inclusive) o ya venció. Se muestra en:
- pantalla de Reclamos (banda superior + KPI)
- dashboard
- pendientes (cuando exista ese módulo)

**Estados:**

```
borrador → por_presentar → presentado → escalado → cobrado
                                     ↘ cobrado
                                     ↘ rechazado
              ↘ descartado (en cualquier momento antes de presentado)
```

- `borrador`: cargado, falta info.
- `por_presentar`: completo, todavía no se subió a Airbnb.
- `presentado`: se envió la solicitud al huésped en el Centro de resoluciones. Setea `presentado_at`
  y pide el link del caso (`url_airbnb`).
- `escalado`: el huésped no pagó, se envió el formulario a AirCover. Setea `escalado_at`.
- `cobrado`: setea `resuelto_at` y `monto_cobrado_usd` (puede ser parcial).
- `rechazado`: setea `resuelto_at`, `monto_cobrado_usd = 0`.
- `descartado`: se decidió no reclamar.

Los reclamos cobrados **no** impactan liquidaciones ni equity — el dinero se ve después en ingresos.

## 3. Esquema (Supabase / Postgres)

```sql
create type reclamo_estado as enum (
  'borrador','por_presentar','presentado','escalado','cobrado','rechazado','descartado'
);

create type reclamo_categoria as enum (
  'mobiliario','electrodomestico','limpieza_extraordinaria','faltante',
  'edilicio','huespedes_no_declarados','otro'
);

create type reclamo_foto_origen as enum ('limpieza','manual');

create table reclamos (
  id                  uuid primary key default gen_random_uuid(),
  reserva_id          uuid not null unique references reservas(id) on delete restrict,
  categoria           reclamo_categoria not null default 'otro',
  motivo              text not null,
  monto_reclamado_usd numeric(10,2) not null check (monto_reclamado_usd > 0),
  monto_cobrado_usd   numeric(10,2) check (monto_cobrado_usd >= 0),
  estado              reclamo_estado not null default 'borrador',
  url_airbnb          text check (url_airbnb is null or url_airbnb ~* '^https://(www\.)?[a-z]{2,3}\.?airbnb\.[a-z.]+/'),
  presentado_at       timestamptz,
  escalado_at         timestamptz,
  resuelto_at         timestamptz,
  nota_interna        text,
  created_by          uuid not null references usuarios(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index on reclamos (estado);
create index on reclamos (reserva_id);

create table reclamo_fotos (
  id           uuid primary key default gen_random_uuid(),
  reclamo_id   uuid not null references reclamos(id) on delete cascade,
  storage_path text not null,
  origen       reclamo_foto_origen not null default 'manual',
  tomada_at    timestamptz,
  orden        int not null default 0,
  created_at   timestamptz not null default now()
);

create index on reclamo_fotos (reclamo_id, orden);
```

Los plazos **no** se guardan: se derivan del check-out de la reserva. Vista de apoyo:

```sql
create view reclamos_con_plazos as
select
  r.*,
  res.codigo         as codigo_reserva,
  res.huesped_nombre,
  res.check_in,
  res.check_out,
  d.nombre           as departamento,
  (res.check_out::date + 14) as limite_resolucion,
  (res.check_out::date + 30) as limite_aircover,
  case
    when r.estado in ('borrador','por_presentar') then (res.check_out::date + 14)
    when r.estado = 'presentado'                  then (res.check_out::date + 30)
    else null
  end as limite_vigente
from reclamos r
join reservas res on res.id = r.reserva_id
join departamentos d on d.id = res.departamento_id;
```

Días restantes en el cliente: `differenceInCalendarDays(limite_vigente, hoyEnBuenosAires)`.
Semáforo: `≤ 0` rojo (vencido), `1–3` rojo (urgente), `4–7` ámbar, `> 7` neutro.

## 4. Permisos (RLS)

| Rol | Reclamos |
|---|---|
| admin (Marcos) | todo |
| ops (Maguie) | todo |
| gobernanta | lectura sin montos |
| limpieza | sin acceso |

- `reclamos` y `reclamo_fotos` con RLS activo; `select/insert/update` solo para `admin` y `ops`.
- Para gobernanta, exponer una vista `reclamos_sin_montos` que excluya `monto_reclamado_usd`,
  `monto_cobrado_usd` y `nota_interna`, con su propia policy de `select`.
- Nunca hacer el filtrado de montos en el cliente.

**Storage:** bucket privado `reclamos`, path `reclamos/{reclamo_id}/{uuid}.{ext}`.
Acceso siempre por signed URL con expiración corta, generada en el servidor. Nada público.

## 5. Rutas y pantallas

```
/reclamos                      lista + filtros + alerta de vencimientos
/reclamos/nuevo?reserva={id}   alta precargada desde la reserva
/reclamos/[id]                 ficha
```

### 5.1 Lista `/reclamos`

- Banda superior si hay vencimientos: "N reclamos vencen en los próximos 3 días."
  No mostrar la banda si N = 0.
- KPIs clickeables que filtran: **Vencen en 3 días** · **Sin presentar** · **Esperando Airbnb** · **Cobrado (mes)**.
- Filtros: texto libre (código, huésped, departamento, motivo), estado, departamento.
- Cada fila: departamento + badge de vencimiento · categoría, huésped, código, fecha de check-out ·
  monto y estado a la derecha. Click abre la ficha. Si el reclamo tiene `url_airbnb`, ícono de
  link externo a la derecha del estado, que abre el caso en Airbnb sin entrar a la ficha.
- Botón **Cargar reclamo** → modal de búsqueda de reserva por código o nombre de huésped.
  Al elegir una reserva que ya tiene reclamo, redirigir a la ficha existente en vez de crear otro.
- Vacío: "No hay reclamos con estos filtros. Probá ampliar el estado o el departamento."

### 5.2 Ficha `/reclamos/[id]`

Bloque fijo arriba (solo lectura, viene de la reserva):
nombre del huésped, código de reserva, departamento, check-in, check-out.
Debajo, el aviso de plazo con el semáforo y ambas fechas límite.

Acordeones (misma convención que el resto del sistema: título en mayúsculas, borde izquierdo,
fondo suave):

1. **Detalle del reclamo** — motivo (textarea, es el texto que se copia al Centro de resoluciones),
   monto reclamado en USD, categoría.
2. **Evidencia (N)** — grilla de fotos con etiqueta de origen ("Limpieza" / sin etiqueta si es manual),
   botón de eliminar por foto, botón de agregar. Acepta imágenes y PDF (presupuestos).
3. **Seguimiento** — timeline de estados con fecha y autor. Si hay `url_airbnb`, botón
   **Abrir en Airbnb** (`target="_blank" rel="noopener noreferrer"`) visible también en el
   bloque fijo de arriba, para saltar directo al caso sin buscarlo en el Centro de resoluciones.

Acciones al pie según estado:
- `borrador` / `por_presentar`: **Marcar como presentado**, Guardar, Descartar reclamo.
- `presentado`: **Escalar a AirCover**, **Registrar cobro**, **Marcar rechazado**.
- `escalado`: **Registrar cobro**, **Marcar rechazado**.
- `cobrado` / `rechazado` / `descartado`: solo lectura, con opción de reabrir para admin.

"Marcar como presentado" abre un diálogo que pide el link del caso en Airbnb. El campo es
opcional (se puede presentar y pegar el link después) pero se ofrece siempre, y también es
editable desde la ficha. Validar que sea una URL de airbnb.com; si no, avisar sin bloquear.

"Registrar cobro" pide `monto_cobrado_usd` (puede ser menor al reclamado).

### 5.3 Desde la ficha de reserva

Botón en las acciones de la reserva:
- sin reclamo → **Cargar reclamo** → `/reclamos/nuevo?reserva={id}`
- con reclamo → **Ver reclamo** + badge de vencimiento si está por vencer.

## 6. Fotos de la limpieza

Al crear un reclamo, se adjuntan automáticamente las fotos que la limpieza cargó en el
check-out de esa reserva, con `origen = 'limpieza'`. Maguie puede borrar las que no sirvan
y agregar otras (`origen = 'manual'`).

El módulo de limpiezas todavía no existe. Implementar detrás de una función única:

```ts
// lib/reclamos/fotos-limpieza.ts
export async function fotosDeLimpieza(reservaId: string): Promise<FotoLimpieza[]>
```

Por ahora devuelve `[]`. Cuando exista el módulo, se cambia solo esta función.
No dispersar la lógica por los componentes.

## 7. Fase 1 — alcance

Incluir: todo lo de arriba.

No incluir: notificaciones push, mail, export, integración con la API de Airbnb,
múltiples ítems por reclamo, conversión de moneda.

**Pendiente de decisión (no implementar hasta confirmar):** listado en Pendientes de los
check-outs de los últimos 14 días sin reclamo cargado ni descartado, con acción rápida
"sin daños". Sin esto, el módulo depende de que alguien se acuerde de entrar.
