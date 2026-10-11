-- ============================================================================
-- Módulo Calidad: reseñas de Airbnb (docs/CALIDAD-ESPECIFICACION.md).
--
-- Decisiones del dueño, 06-07/10/2026. Lo que hace esta migración:
--
--   1. `puede_ver_calidad()`: la única puerta del módulo (manager y admin).
--   2. `departamentos.airbnb_listing_id`, completado desde las URLs que ya
--      están cargadas.
--   3. Las tablas nuevas: cargas, reseñas, etiquetas, listado histórico de
--      limpiezas y reseñas revisadas.
--   4. La vista `resenas_atribuidas`: cada reseña con su limpieza anterior y
--      quién la hizo.
--   5. Saca `puntajes_calidad`, que nació vacía y nunca se usó.
--
-- Lo que NO toca, a propósito:
--
--   - `limpiezas`. El listado histórico NO asigna limpiezas: asignar copia
--     `monto_pactado` y eso termina en pagos. Vive en su propia tabla y solo
--     lo lee la vista de atribución.
--   - `alerta_revisada`. Exige `limpieza_id` y el panel de Alertas depende de
--     eso. Las reseñas revisadas van a su propia tabla.
--   - `importaciones`. Es el lote del importador de reservas (se lista y se
--     deshace desde /importar). Las cargas de reseñas tienen la suya.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Quién ve Calidad: manager y administración (decisión del dueño,
--    07/10/2026). Incluye comentarios privados de los huéspedes y el ranking
--    del personal de limpieza.
--
--    Una función y no la regla repetida en cada política, como
--    `puede_ver_economico()`: si cambia, cambia en un solo lugar.
-- ----------------------------------------------------------------------------

create or replace function puede_ver_calidad()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from personas p
     where p.profile_id = auth.uid()
       and p.activo
       and p.rol in ('admin', 'manager')
  );
$$;

-- ----------------------------------------------------------------------------
-- 2. El ID del anuncio de Airbnb en el departamento.
--
--    El Excel de reseñas identifica el anuncio por número, el mismo que está
--    en la URL del calendario (/calendar/ical/<ID>.ics) y en la de la
--    publicación (/rooms/<ID>). El número no cambia aunque cambie el título
--    del anuncio, que nunca es clave (CLAUDE.md, regla 6).
--
--    Revisado antes de escribir esto (11/10/2026): 76 departamentos tienen
--    número en alguna de las dos URLs, en los 51 que tienen las dos el número
--    coincide, y ninguno se repite entre departamentos.
-- ----------------------------------------------------------------------------

alter table departamentos add column airbnb_listing_id text;

comment on column departamentos.airbnb_listing_id is
  'Número del anuncio en Airbnb. Une las reseñas con el departamento. Sale de ical_url o url_publicacion.';

update departamentos
   set airbnb_listing_id = coalesce(
         substring(ical_url from '/calendar/ical/([0-9]+)\.ics'),
         substring(url_publicacion from '/rooms/([0-9]+)')
       )
 where coalesce(
         substring(ical_url from '/calendar/ical/([0-9]+)\.ics'),
         substring(url_publicacion from '/rooms/([0-9]+)')
       ) is not null;

-- Si algún día dos departamentos quedaran con el mismo número, el índice no
-- se crea y la migración entera se deshace: nada queda a medias.
create unique index departamentos_airbnb_listing_id_unico
  on departamentos (airbnb_listing_id)
  where airbnb_listing_id is not null;

-- ----------------------------------------------------------------------------
-- 3a. Cargas de reseñas. Una fila por Excel confirmado.
-- ----------------------------------------------------------------------------

create table importaciones_resenas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid references auth.users (id),
  archivo_nombre text not null,
  -- sha256 del contenido: avisa si se sube dos veces el mismo archivo.
  archivo_hash text not null,
  filas_leidas integer not null default 0,
  nuevas integer not null default 0,
  actualizadas integer not null default 0,
  sin_cambios integer not null default 0,
  sin_depto integer not null default 0,
  sin_reserva integer not null default 0,
  avisos jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_importaciones_resenas_hash on importaciones_resenas (archivo_hash);

-- ----------------------------------------------------------------------------
-- 3b. Reseñas. Una fila por reseña de Airbnb, para siempre (§3.1).
-- ----------------------------------------------------------------------------

create table resenas (
  id uuid primary key default gen_random_uuid(),
  -- Clave natural del upsert: subir el mismo Excel dos veces no duplica.
  airbnb_resena_id text not null unique,
  airbnb_listing_id text not null,
  depto_id uuid references departamentos (id),  -- null = anuncio sin vincular
  reserva_id uuid references reservas (id),     -- null = estadía fuera del sistema
  anuncio_raw text,                             -- solo para mostrar, nunca clave
  huesped_nombre text,
  fecha_checkin date not null,
  fecha_checkout date not null,
  puntaje_general smallint not null check (puntaje_general between 1 and 5),
  puntaje_limpieza smallint check (puntaje_limpieza between 1 and 5),
  puntaje_veracidad smallint check (puntaje_veracidad between 1 and 5),
  puntaje_checkin smallint check (puntaje_checkin between 1 and 5),
  puntaje_comunicacion smallint check (puntaje_comunicacion between 1 and 5),
  puntaje_ubicacion smallint check (puntaje_ubicacion between 1 and 5),
  puntaje_precio smallint check (puntaje_precio between 1 and 5),
  resena_publica text,
  comentario_privado text,
  respuesta_anfitrion text,
  idioma text,
  raw jsonb,
  import_id uuid references importaciones_resenas (id), -- última carga que la tocó
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_checkout > fecha_checkin)
);

create index idx_resenas_depto_checkout on resenas (depto_id, fecha_checkout);
create index idx_resenas_checkout on resenas (fecha_checkout);
create index idx_resenas_reserva on resenas (reserva_id);

-- ----------------------------------------------------------------------------
-- 3c. Etiquetas de cada reseña: "(-) El baño estaba sucio" y compañía.
--     Una fila por línea, para poder contarlas por departamento y persona.
-- ----------------------------------------------------------------------------

create type resena_categoria as enum
  ('limpieza', 'veracidad', 'checkin', 'comunicacion', 'ubicacion', 'precio');

create type resena_signo as enum ('positiva', 'negativa', 'otro');

create table resena_etiquetas (
  id uuid primary key default gen_random_uuid(),
  resena_id uuid not null references resenas (id),
  categoria resena_categoria not null,
  signo resena_signo not null,
  texto text not null,
  created_at timestamptz not null default now(),
  unique (resena_id, categoria, texto)
);

create index idx_resena_etiquetas_negativas
  on resena_etiquetas (categoria, texto) where signo = 'negativa';

-- ----------------------------------------------------------------------------
-- 3d. Listado histórico de limpiezas (LIMPIEZAS.xlsx, 29/05 a 03/09/2026).
--
--     Sirve SOLO para atribuir reseñas cuya limpieza no tiene responsable en
--     el sistema. Las limpiezas se asignan en el sistema desde el 02/08/2026
--     y todas desde el 14/08/2026; antes, la asignación vivía afuera.
-- ----------------------------------------------------------------------------

create table limpiezas_historicas (
  id uuid primary key default gen_random_uuid(),
  depto_id uuid not null references departamentos (id),
  fecha date not null,
  persona_id uuid not null references personas (id),
  origen text not null,  -- de qué archivo salió
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (depto_id, fecha, persona_id)
);

create index idx_limpiezas_historicas_depto_fecha on limpiezas_historicas (depto_id, fecha);

-- ----------------------------------------------------------------------------
-- 3e. Alertas de calidad dadas por revisadas.
--
--     Mismo criterio que `alerta_revisada`: se guarda la FIRMA de lo que se
--     revisó (puntajes + etiquetas negativas). Si una carga posterior cambia
--     la reseña, la firma deja de coincidir y la alerta vuelve sola.
-- ----------------------------------------------------------------------------

create table resena_revisada (
  id uuid primary key default gen_random_uuid(),
  resena_id uuid not null unique references resenas (id),
  firma text not null,
  revisada_por uuid references personas (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Triggers. `updated_at` en todas las que lo tienen.
--
-- Auditoría (`audit_trigger`) en el listado histórico y en las revisadas, que
-- son decisiones de una persona. NO en `resenas` ni `resena_etiquetas`, a
-- propósito: son una copia de Airbnb que se recarga entera, la trazabilidad
-- la dan `import_id` y `raw`, y el diff del log llevaría los comentarios
-- privados a `audit_log`, que leen todos los roles de oficina (también
-- coordinación y gobernanta). Eso abriría lo que §3.8 cierra.
-- ----------------------------------------------------------------------------

create trigger updated_at_importaciones_resenas before update on importaciones_resenas
  for each row execute function set_updated_at();
create trigger updated_at_resenas before update on resenas
  for each row execute function set_updated_at();
create trigger updated_at_limpiezas_historicas before update on limpiezas_historicas
  for each row execute function set_updated_at();
create trigger updated_at_resena_revisada before update on resena_revisada
  for each row execute function set_updated_at();

create trigger audit_limpiezas_historicas
  after insert or update or delete on limpiezas_historicas
  for each row execute function audit_trigger();
create trigger audit_resena_revisada
  after insert or update or delete on resena_revisada
  for each row execute function audit_trigger();

-- ----------------------------------------------------------------------------
-- RLS: todo el módulo, solo manager y administración.
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'importaciones_resenas', 'resenas', 'resena_etiquetas',
    'limpiezas_historicas', 'resena_revisada'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon', t);
    execute format(
      'create policy %1$s_calidad on %1$I
         for all to authenticated
         using (puede_ver_calidad())
         with check (puede_ver_calidad())', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- 4. Cada reseña con la limpieza anterior a la estadía y su responsable
--    (§3.4 y §3.5).
--
--    La limpieza anterior es la última del departamento entre el check-out
--    anterior y el check-in de la reseña. Se excluyen las canceladas y las
--    `durante` (son de la estadía del huésped anterior). Sin check-out
--    anterior conocido se mira hasta 15 días para atrás.
--
--    El responsable: el del sistema si la limpieza está asignada; si no, el
--    del listado histórico en la misma ventana; si no, nadie.
--
--    Se CALCULA, no se guarda: si mañana se corrige una asignación, el ranking
--    se corrige solo.
--
--    `security_invoker`: la vista corre con los permisos de quien consulta,
--    así el RLS de `resenas` la cierra igual que a la tabla. Sin esto, una
--    vista corre como su dueño y cualquier autenticado leería las reseñas.
-- ----------------------------------------------------------------------------

create view resenas_atribuidas
with (security_invoker = true) as
select
  r.*,
  ant.fecha_checkout as checkout_anterior,
  lim.id as limpieza_id,
  lim.fecha as limpieza_fecha,
  coalesce(lim.asignado_a, his.persona_id) as responsable_id,
  case
    when lim.asignado_a is not null then 'sistema'
    when his.persona_id is not null then 'listado'
  end as origen_responsable
from resenas r
left join lateral (
  select max(x.fecha_checkout) as fecha_checkout
    from reservas x
   where x.depto_id = r.depto_id
     and not x.cancelada
     and not x.descartada
     and x.fecha_checkout <= r.fecha_checkin
     and x.id is distinct from r.reserva_id
) ant on true
left join lateral (
  select l.id, l.fecha, l.asignado_a
    from limpiezas l
   where l.depto_id = r.depto_id
     and l.estado <> 'cancelada'
     and l.rol_reserva is distinct from 'durante'
     and l.fecha <= r.fecha_checkin
     and l.fecha >= coalesce(ant.fecha_checkout, r.fecha_checkin - 15)
   order by l.fecha desc, l.asignado_a is null
   limit 1
) lim on true
left join lateral (
  select h.persona_id
    from limpiezas_historicas h
   where h.depto_id = r.depto_id
     and h.activo
     and h.fecha <= r.fecha_checkin
     and h.fecha >= coalesce(ant.fecha_checkout, r.fecha_checkin - 15)
   order by h.fecha desc, h.created_at
   limit 1
) his on true;

revoke all on resenas_atribuidas from anon;

-- ----------------------------------------------------------------------------
-- 5. `puntajes_calidad` sale. Era el formato de dos columnas (código +
--    puntaje) que preveía §3.9 de la Fase 1, reemplazado por `resenas`.
--    Nunca tuvo pantalla ni datos. Si por algún motivo tuviera filas, la
--    migración se detiene entera y no se pierde nada.
-- ----------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from puntajes_calidad) then
    raise exception 'puntajes_calidad tiene filas: revisar antes de eliminarla';
  end if;
end;
$$;

drop table puntajes_calidad;
