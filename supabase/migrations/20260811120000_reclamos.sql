-- Módulo de reclamos a Airbnb (docs/FASE-1-RECLAMOS-ESPECIFICACION.md).
--
-- La tabla `reclamos` ya existía como borrador de la migración inicial, sin
-- monto, con el estado como texto libre y con la fecha límite guardada. Estaba
-- VACÍA (0 filas, verificado antes de escribir esto), así que se rehace con la
-- forma definitiva en vez de parchearla.
--
-- Los plazos NO se guardan: se derivan del check-out de la reserva
-- (lib/reclamos/plazos.ts). Guardar una fecha límite calculada es tener dos
-- versiones de la verdad, y la que queda vieja es siempre la guardada.

create type reclamo_estado as enum (
  'borrador', 'por_presentar', 'presentado', 'escalado',
  'cobrado', 'rechazado', 'descartado'
);

create type reclamo_categoria as enum (
  'mobiliario', 'electrodomestico', 'limpieza_extraordinaria', 'faltante',
  'edilicio', 'huespedes_no_declarados', 'otro'
);

create type reclamo_foto_origen as enum ('limpieza', 'manual');

drop table reclamos;

create table reclamos (
  id uuid primary key default gen_random_uuid(),
  -- Un reclamo por reserva: si el huésped rompió tres cosas, van todas en el
  -- mismo reclamo con un motivo libre y un monto total.
  reserva_id uuid not null unique references reservas (id),
  categoria reclamo_categoria not null default 'otro',
  -- El texto que se copia y pega en el Centro de resoluciones de Airbnb.
  motivo text,
  -- Monto y moneda juntos siempre (CLAUDE.md, regla 2). Hoy la operación es
  -- solo en dólares, pero el número nunca viaja suelto.
  monto_reclamado numeric check (monto_reclamado is null or monto_reclamado > 0),
  monto_cobrado numeric check (monto_cobrado is null or monto_cobrado >= 0),
  moneda text not null default 'USD',
  estado reclamo_estado not null default 'borrador',
  -- Link al caso en Airbnb. Sin validación de base a propósito: la pantalla
  -- avisa si no parece de Airbnb, pero no bloquea guardar.
  url_airbnb text,
  presentado_at timestamptz,
  escalado_at timestamptz,
  resuelto_at timestamptz,
  nota_interna text,
  creado_por uuid references auth.users (id) default auth.uid(),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reclamos_estado on reclamos (estado);
create index idx_reclamos_reserva on reclamos (reserva_id);

create table reclamo_fotos (
  id uuid primary key default gen_random_uuid(),
  reclamo_id uuid not null references reclamos (id),
  storage_path text not null,
  origen reclamo_foto_origen not null default 'manual',
  tomada_at timestamptz,
  orden integer not null default 0,
  -- Baja lógica: sacar una foto de la evidencia la oculta, no la destruye
  -- (CLAUDE.md, regla 3). Es la prueba de un reclamo de plata.
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_reclamo_fotos_reclamo on reclamo_fotos (reclamo_id, orden);

create trigger audit_reclamos after insert or update or delete on reclamos
  for each row execute function audit_trigger();
create trigger audit_reclamo_fotos after insert or update or delete on reclamo_fotos
  for each row execute function audit_trigger();

create trigger updated_at_reclamos before update on reclamos
  for each row execute function set_updated_at();
create trigger updated_at_reclamo_fotos before update on reclamo_fotos
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Permisos: los reclamos los ven back office, manager y administración
-- (decisión del dueño, 11/08/2026). La gobernanta y el personal de limpieza
-- no acceden: acá hay montos.
-- ----------------------------------------------------------------------------

create or replace function puede_gestionar_reclamos()
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
       and (p.rol in ('admin', 'manager') or p.es_backoffice)
  );
$$;

alter table reclamo_fotos enable row level security;

-- La tabla vieja traía la política general de Fase 1; la nueva arranca limpia.
drop policy if exists autenticados_todo on reclamos;

create policy reclamos_gestion on reclamos
  for all to authenticated
  using (puede_gestionar_reclamos())
  with check (puede_gestionar_reclamos());

create policy reclamo_fotos_gestion on reclamo_fotos
  for all to authenticated
  using (puede_gestionar_reclamos())
  with check (puede_gestionar_reclamos());

-- ----------------------------------------------------------------------------
-- Storage: bucket privado. Las fotos se sirven siempre por URL firmada
-- generada en el servidor, nunca por link público.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('reclamos', 'reclamos', false)
on conflict (id) do nothing;

create policy reclamos_storage_gestion on storage.objects
  for all to authenticated
  using (bucket_id = 'reclamos' and puede_gestionar_reclamos())
  with check (bucket_id = 'reclamos' and puede_gestionar_reclamos());
