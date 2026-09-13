-- Cancelaciones y cambios inferidos del calendario de Airbnb
-- (decisión del dueño, 13/09/2026).
--
-- QUÉ CAMBIÓ
--
-- Airbnb sacó la exportación del archivo de reservas. Era lo único que decía
-- "esta reserva se canceló" o "cambió de fecha". El calendario (iCal) no trae
-- estado: una reserva cancelada simplemente DESAPARECE, y una modificada
-- aparece con otras fechas o en el calendario de otro departamento.
--
-- Al 13/09/2026, comparando los 53 calendarios contra la base: 15 reservas
-- futuras ya no estaban en Airbnb, 3 tenían otras fechas y 3 figuraban en
-- otro departamento. Nadie se había enterado.
--
-- LA REGLA
--
-- El sistema INFIERE, pero no decide. Cada situación queda anotada acá como
-- `pendiente` y una persona (admin, manager o coordinación) la confirma o la
-- descarta desde el panel de alertas. La reserva no se toca hasta entonces.
--
-- Por qué no se aplica sola: un departamento con dos anuncios de Airbnb tiene
-- un solo calendario cargado, y una reserva hecha en el otro anuncio "no
-- aparece" sin estar cancelada. Y un calendario que viene vacío (link
-- regenerado, anuncio pausado) haría desaparecer todo junto.
--
-- Por qué una tabla y no una columna en `reservas`: hace falta recordar lo
-- que se descartó. Si alguien dice "sigue en pie", la marca no puede volver
-- en cada sincronización. Se guarda la FIRMA de la situación revisada (mismo
-- criterio que `limpiezas.conflicto_resuelto` y `alerta_revisada`): si la
-- situación cambia, la firma no coincide y la marca vuelve.

create type cambio_calendario_tipo as enum (
  'posible_cancelacion', -- no está en ningún calendario
  'cambio_fechas',       -- está, con otras fechas
  'cambio_depto'         -- está, en el calendario de otro departamento
);

create type cambio_calendario_estado as enum (
  'pendiente',     -- esperando que alguien decida
  'confirmado',    -- se aplicó (cancelación o fechas nuevas)
  'descartado',    -- una persona dijo que no corresponde
  'resuelto_solo'  -- la reserva volvió a coincidir con el calendario
);

create table cambios_calendario (
  id uuid primary key default gen_random_uuid(),
  reserva_id uuid not null references reservas (id),
  tipo cambio_calendario_tipo not null,
  estado cambio_calendario_estado not null default 'pendiente',

  -- Lo que mostraba el calendario. Vacío en una posible cancelación.
  calendario_checkin date,
  calendario_checkout date,
  calendario_depto_id uuid references departamentos (id),

  -- Cómo estaba la reserva cuando se detectó, para que se entienda el cambio
  -- aunque después alguien la edite.
  reserva_checkin date,
  reserva_checkout date,
  reserva_depto_id uuid references departamentos (id),

  -- La situación exacta. Un descarte solo tapa esta firma.
  firma text not null,

  resuelto_por uuid references personas (id),
  resuelto_at timestamptz,

  -- Un descarte deja de valer (activo = false) cuando la reserva vuelve a
  -- coincidir con el calendario: si después vuelve a desaparecer, es una
  -- situación nueva y tiene que avisar.
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table cambios_calendario is
  'Cancelaciones y cambios de fecha o de departamento inferidos del calendario de Airbnb. Se confirman a mano desde el panel de alertas.';

-- Una sola marca pendiente por reserva y tipo.
create unique index cambios_calendario_pendiente_unico
  on cambios_calendario (reserva_id, tipo)
  where estado = 'pendiente';

create index idx_cambios_calendario_reserva on cambios_calendario (reserva_id);
create index idx_cambios_calendario_estado on cambios_calendario (estado);

create trigger audit_cambios_calendario
  after insert or update or delete on cambios_calendario
  for each row execute function audit_trigger();

create trigger updated_at_cambios_calendario before update on cambios_calendario
  for each row execute function set_updated_at();

alter table cambios_calendario enable row level security;

-- Mismo criterio que `reservas`: todos menos limpieza. La sincronización la
-- puede disparar cualquiera que pueda escribir reservas; quién CONFIRMA lo
-- controla la pantalla (admin, manager y coordinación).
create policy cambios_calendario_acceso on cambios_calendario
  for all to authenticated
  using (mi_rol() <> 'limpieza')
  with check (mi_rol() <> 'limpieza');

-- ----------------------------------------------------------------------------
-- Registro de cada sincronización.
--
-- La automática corre de madrugada y nadie mira su resultado. Sin esto, un
-- calendario que no se pudo leer o una desaparición masiva frenada pasaban
-- en silencio. El panel de alertas lee la última corrida completa.
-- ----------------------------------------------------------------------------

create table sincronizaciones_ical (
  id uuid primary key default gen_random_uuid(),
  -- true si leyó todos los calendarios; false si fue la de un solo depto.
  completa boolean not null,
  -- Los contadores y avisos de la corrida (ResumenSync).
  resumen jsonb not null,
  -- Posibles cancelaciones que NO se marcaron por el freno de desaparición
  -- masiva: [{ depto_id, motivo, reserva_ids }].
  retenidas jsonb not null default '[]',
  -- Calendarios que no se pudieron leer: [{ depto_id, error }].
  fallidos jsonb not null default '[]',
  created_at timestamptz not null default now()
);

comment on table sincronizaciones_ical is
  'Una fila por sincronización de calendarios. Guarda lo que se frenó y lo que no se pudo leer, para que no pase en silencio.';

create index idx_sincronizaciones_ical_fecha on sincronizaciones_ical (created_at desc);

alter table sincronizaciones_ical enable row level security;

create policy sincronizaciones_ical_acceso on sincronizaciones_ical
  for all to authenticated
  using (mi_rol() <> 'limpieza')
  with check (mi_rol() <> 'limpieza');
