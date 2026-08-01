-- ============================================================================
-- MTHosting — Migración inicial: esquema completo
--
-- Crea TODAS las tablas de la especificación (docs/FASE-1-ESPECIFICACION.md §1),
-- incluidas las que no tienen UI en Fase 1. Reglas aplicadas (CLAUDE.md):
--   - Fechas de negocio como `date`, nunca timestamptz.
--   - Dinero siempre monto + moneda.
--   - Bajas lógicas (`activo`), sin DELETE físico de datos operativos.
--   - Tarifas versionadas por fecha, nunca UPDATE del monto.
--   - Trigger genérico de auditoría sobre las tablas operativas.
--   - RLS en todas las tablas: solo usuarios autenticados, nada para anon.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

create type rol_usuario as enum
  ('admin', 'manager', 'gobernanta', 'coordinador', 'limpieza', 'propietario');

create type modalidad_pago as enum
  ('por_limpieza', 'sueldo_mensual', 'ambas');

create type acuerdo_pago as enum
  ('cobra_todo_mth', 'cobra_cada_uno', 'solo_comision');

create type depto_estado as enum ('activo', 'suspendido');

create type ambientes_tipo as enum ('monoambiente', 'dos', 'tres', 'cuatro');

create type self_checkout_tipo as enum ('siempre', 'solo_multiples', 'no');

create type canal_tipo as enum ('airbnb', 'booking', 'directa');

create type origen_reserva as enum ('csv', 'ical');

create type llegada_desde_tipo as enum ('depto', 'eze', 'aep', 'bqb');

create type metodo_acceso as enum
  ('presencial', 'candado', 'sobre', 'valijas', 'self', 'llaves');

create type movimiento_tipo as enum ('dejada', 'retirada');

create type evento_tipo as enum ('checkin', 'checkout');

create type evento_estado as enum ('pendiente', 'coordinado', 'hecho', 'cancelado');

create type rol_reserva_tipo as enum ('salida', 'entrada', 'durante');

create type limpieza_tipo as enum
  ('inicial', 'repaso', 'normal', 'cambio_blancos', 'con_huespedes',
   'desmantelar', 'propietario');

create type limpieza_estado as enum
  ('pendiente', 'asignada', 'en_curso', 'hecha', 'verificada', 'cancelada');

create type bloqueo_motivo as enum
  ('mantenimiento', 'uso_propietario', 'vacio', 'otro');

-- ----------------------------------------------------------------------------
-- Trigger genérico de updated_at
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- Tablas con UI en Fase 1
-- ----------------------------------------------------------------------------

create table personas (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references auth.users (id),
  nombre text not null,
  telefono text,
  hace_limpieza boolean not null default false,
  hace_checkin boolean not null default false,
  es_backoffice boolean not null default false,
  modalidad_pago modalidad_pago,
  rol rol_usuario,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table propietarios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  contacto text,
  comision_pct numeric,
  acuerdo_pago acuerdo_pago,
  cuenta_cobro text,
  datos_bancarios text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table departamentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  nombre_interno text not null,
  propietario_id uuid references propietarios (id),
  estado depto_estado not null default 'activo',
  direccion text,
  barrio text,
  ambientes ambientes_tipo,
  habitaciones integer,
  capacidad integer,
  wifi_ssid text,
  wifi_pass text,
  -- credenciales de Airbnb: se guardan CIFRADAS por la aplicación, solo admin
  airbnb_user text,
  airbnb_pass text,
  url_publicacion text,
  url_mapa text,
  ical_url text,
  encargado_nombre text,
  encargado_telefono text,
  propietario_telefono text,
  self_checkout self_checkout_tipo not null default 'no',
  -- distinguen "no corresponde" de "falta hacerlo"
  requiere_registro boolean not null default false,
  requiere_aviso_seguridad boolean not null default false,
  indicaciones_acceso text,
  indicaciones_archivos jsonb not null default '[]',
  trabajo_verificado boolean not null default false,
  observacion text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table listing_alias (
  id uuid primary key default gen_random_uuid(),
  depto_id uuid not null references departamentos (id),
  canal canal_tipo not null,
  nombre_listing text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (canal, nombre_listing)
);

create table puntos_acceso (
  id uuid primary key default gen_random_uuid(),
  metodo metodo_acceso not null,
  ubicacion text,
  identificador text,
  instrucciones text,
  sirve_checkin boolean not null default true,
  sirve_checkout boolean not null default true,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table importaciones (
  id uuid primary key default gen_random_uuid(),
  archivos jsonb not null default '[]', -- [{nombre, hash}]
  usuario_id uuid references auth.users (id),
  filas_total integer,
  nuevas integer,
  actualizadas integer,
  sin_cambios integer,
  sin_asignar integer,
  canceladas_detectadas integer,
  descartadas_reaparecidas integer,
  anomalias jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reservas (
  id uuid primary key default gen_random_uuid(),
  codigo_reserva text not null unique, -- clave natural del upsert
  canal canal_tipo not null default 'airbnb',
  origen origen_reserva not null,
  datos_completos boolean not null default true,
  depto_id uuid references departamentos (id), -- null = bandeja sin asignar
  listing_nombre_raw text,
  huesped_nombre text,
  huesped_contacto text,
  adultos integer,
  ninos integer,
  bebes integer,
  noches integer,
  fecha_checkin date,
  fecha_checkout date,
  fecha_checkout_real date,
  fecha_reservada date,
  cancelada boolean not null default false, -- terminal: nunca se revierte
  payout_monto numeric,
  payout_moneda text default 'USD',
  registro_hecho boolean not null default false,
  aviso_seguridad_hecho boolean not null default false,
  sobre_ok boolean not null default false,
  llegada_desde llegada_desde_tipo,
  descartada boolean not null default false,
  raw jsonb,
  import_id uuid references importaciones (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table eventos_estadia (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas (id),
  tipo evento_tipo not null,
  fecha_coordinada date,
  hora_coordinada time,
  punto_acceso_id uuid references puntos_acceso (id),
  responsable_id uuid references personas (id),
  punto_devolucion_id uuid references puntos_acceso (id),
  responsable_devolucion_id uuid references personas (id),
  late_checkout boolean not null default false,
  acceso_dejado boolean not null default false, -- solo check-in
  estado evento_estado not null default 'pendiente',
  observaciones text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (reserva_id, tipo),
  -- punto de acceso O responsable, nunca ambos
  check (punto_acceso_id is null or responsable_id is null)
);

create table movimientos_acceso (
  id uuid primary key default gen_random_uuid(),
  punto_acceso_id uuid not null references puntos_acceso (id),
  evento_id uuid not null references eventos_estadia (id),
  depto_id uuid not null references departamentos (id),
  tipo movimiento_tipo not null,
  confirmado boolean not null default false,
  persona_id uuid references personas (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tarifas (
  id uuid primary key default gen_random_uuid(),
  ambientes ambientes_tipo,
  depto_id uuid references departamentos (id), -- excepción puntual
  monto numeric not null,
  moneda text not null,
  vigente_desde date not null,
  vigente_hasta date, -- null = vigente; lo cierra el sistema, nunca UPDATE del monto
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ambientes is not null or depto_id is not null)
);

create table limpiezas (
  id uuid primary key default gen_random_uuid(),
  depto_id uuid not null references departamentos (id), -- directa, nunca derivada
  reserva_id uuid references reservas (id),
  rol_reserva rol_reserva_tipo,
  fecha date not null,
  hora_checkout time,
  prox_checkin timestamp, -- ventana disponible (fecha+hora local, sin tz)
  tipo limpieza_tipo not null default 'normal',
  urgente boolean not null default false,
  asignado_a uuid references personas (id),
  estado limpieza_estado not null default 'pendiente',
  hora_inicio timestamptz, -- Fase 2
  hora_fin timestamptz,    -- Fase 2
  monto_pactado numeric,   -- snapshot al asignar, no se recalcula jamás
  pago_doble boolean not null default false,
  moneda text,
  tarifa_id uuid references tarifas (id), -- trazabilidad
  viatico_monto numeric,        -- Fase 2
  viatico_comprobante text,     -- Fase 2
  viatico_aprobado boolean,     -- Fase 2
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bloqueos (
  id uuid primary key default gen_random_uuid(),
  depto_id uuid not null references departamentos (id),
  fecha_desde date not null,
  fecha_hasta date not null,
  motivo bloqueo_motivo not null,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table feriados (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table puntajes_calidad (
  id uuid primary key default gen_random_uuid(),
  codigo_reserva text not null references reservas (codigo_reserva),
  puntaje integer not null check (puntaje between 1 and 5),
  comentario text,
  fecha date,
  import_id uuid references importaciones (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Parámetros operativos editables (§3.7): umbrales de ventana insuficiente
-- y día de corte de la semana de pago.
create table parametros_operativos (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  valor text not null,
  descripcion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into parametros_operativos (clave, valor, descripcion) values
  ('hora_limite_checkout', '11:00',
   'Hora estándar máxima de check-out. Umbral de la alerta de ventana insuficiente (§2.8.quater)'),
  ('hora_minima_checkin', '12:00',
   'Hora estándar mínima de check-in. Umbral de la alerta de ventana insuficiente (§2.8.quater)'),
  ('dia_corte_semana_pago', 'viernes',
   'Día de corte de la semana de pago (§1.0). Default viernes: se paga viernes anterior → jueves');

-- ----------------------------------------------------------------------------
-- Tablas sin UI en Fase 1 (fases posteriores) — §1.2
-- ----------------------------------------------------------------------------

create table distribucion_depto (
  id uuid primary key default gen_random_uuid(),
  depto_id uuid not null references departamentos (id),
  persona_id uuid not null references personas (id),
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table item_catalogo (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  categoria text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table inventario_depto (
  id uuid primary key default gen_random_uuid(),
  depto_id uuid not null references departamentos (id),
  item_id uuid not null references item_catalogo (id),
  cantidad integer not null default 0,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table limpieza_checklist (
  id uuid primary key default gen_random_uuid(),
  limpieza_id uuid not null references limpiezas (id),
  seccion text not null, -- Cocina / Funcionamiento / Baño / Habitación
  item text not null,
  hecho boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table limpieza_fotos (
  id uuid primary key default gen_random_uuid(),
  limpieza_id uuid not null references limpiezas (id),
  storage_path text not null,
  tipo text, -- terminado / problema
  comentario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table limpieza_faltantes (
  id uuid primary key default gen_random_uuid(),
  limpieza_id uuid not null references limpiezas (id),
  item_id uuid references item_catalogo (id),
  cantidad integer,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table prestadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  telefono text,
  rubro text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table arreglos (
  id uuid primary key default gen_random_uuid(),
  depto_id uuid not null references departamentos (id),
  limpieza_id uuid references limpiezas (id),
  prestador_id uuid references prestadores (id),
  descripcion text not null,
  estado text,
  fecha date,
  costo_monto numeric,
  costo_moneda text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table arreglo_fotos (
  id uuid primary key default gen_random_uuid(),
  arreglo_id uuid not null references arreglos (id),
  storage_path text not null,
  comentario text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reclamos (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid references reservas (id),
  fecha date,
  descripcion text,
  estado text,
  fecha_limite date, -- ventana de 14 días de Airbnb
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reportes (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid references personas (id),
  fecha date,
  contenido text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cuentas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  moneda text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table categorias_gasto (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table gastos (
  id uuid primary key default gen_random_uuid(),
  fecha date,
  cuenta_id uuid references cuentas (id),
  categoria_id uuid references categorias_gasto (id),
  depto_id uuid references departamentos (id),
  monto numeric,
  moneda text,
  tc numeric,        -- tipo de cambio, si hubo conversión
  fecha_tc date,
  descripcion text,
  comprobante text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table cotizaciones (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  tc numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table liquidaciones (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null references propietarios (id),
  periodo_desde date not null,
  periodo_hasta date not null,
  estado text,
  total_monto numeric,
  total_moneda text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table liquidacion_lineas (
  id uuid primary key default gen_random_uuid(),
  liquidacion_id uuid not null references liquidaciones (id),
  concepto text not null,
  monto numeric,
  moneda text,
  reserva_id uuid references reservas (id),
  gasto_id uuid references gastos (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table pagos_personal (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references personas (id),
  periodo_desde date not null,
  periodo_hasta date not null,
  monto numeric,
  moneda text,
  fecha_pago date,
  notas text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Auditoría — tabla y trigger genérico
-- ----------------------------------------------------------------------------

create table audit_log (
  id uuid primary key default gen_random_uuid(),
  tabla text not null,
  registro_id uuid,
  usuario_id uuid,
  accion text not null, -- INSERT / UPDATE / DELETE
  diff jsonb,
  at timestamptz not null default now()
);

create or replace function audit_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_diff jsonb;
  v_registro uuid;
begin
  if tg_op = 'INSERT' then
    v_diff := to_jsonb(new);
    v_registro := new.id;
  elsif tg_op = 'DELETE' then
    v_diff := to_jsonb(old);
    v_registro := old.id;
  else
    -- solo los campos que cambiaron: {campo: {antes, despues}}
    select coalesce(jsonb_object_agg(n.key, jsonb_build_object('antes', o.value, 'despues', n.value)), '{}'::jsonb)
      into v_diff
      from jsonb_each(to_jsonb(old)) o
      join jsonb_each(to_jsonb(new)) n on n.key = o.key
     where o.value is distinct from n.value;
    v_registro := new.id;
  end if;

  insert into audit_log (tabla, registro_id, usuario_id, accion, diff)
  values (tg_table_name, v_registro, auth.uid(), tg_op, v_diff);

  return coalesce(new, old);
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'personas', 'propietarios', 'departamentos', 'listing_alias',
    'puntos_acceso', 'movimientos_acceso', 'importaciones', 'reservas',
    'eventos_estadia', 'tarifas', 'limpiezas', 'bloqueos', 'feriados',
    'puntajes_calidad', 'parametros_operativos'
  ]
  loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on %1$I
         for each row execute function audit_trigger()', t);
  end loop;
end;
$$;

-- updated_at en todas las tablas que lo tienen
do $$
declare
  t text;
begin
  for t in
    select c.table_name
      from information_schema.columns c
     where c.table_schema = 'public' and c.column_name = 'updated_at'
  loop
    execute format(
      'create trigger updated_at_%1$s before update on %1$I
         for each row execute function set_updated_at()', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Índices (CLAUDE.md: desde el inicio)
-- ----------------------------------------------------------------------------

create index idx_limpiezas_depto_fecha on limpiezas (depto_id, fecha);
create index idx_limpiezas_estado on limpiezas (estado);
create index idx_limpiezas_asignado on limpiezas (asignado_a);
create index idx_eventos_fecha_tipo on eventos_estadia (fecha_coordinada, tipo);
create index idx_eventos_reserva on eventos_estadia (reserva_id);
create index idx_reservas_depto_checkin on reservas (depto_id, fecha_checkin);
create index idx_listing_alias_depto on listing_alias (depto_id);
create index idx_audit_log_tabla_registro on audit_log (tabla, registro_id);

-- ----------------------------------------------------------------------------
-- RLS — Fase 1: solo usuarios autenticados, nada para anon.
-- Las políticas finas por rol se endurecen en Fase 2 (§ Seguridad, CLAUDE.md).
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', t);
    if t <> 'audit_log' then
      execute format(
        'create policy autenticados_todo on %I
           for all to authenticated using (true) with check (true)', t);
    end if;
  end loop;
end;
$$;

-- audit_log: los autenticados pueden leer; escribe solo el trigger
-- (security definer). Nadie inserta, edita ni borra a mano.
create policy autenticados_leen_audit on audit_log
  for select to authenticated using (true);
