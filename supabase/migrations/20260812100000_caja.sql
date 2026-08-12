-- Caja: ingresos y egresos con saldo (decisiones del dueño, 11/08/2026).
--
-- La migración inicial había creado `gastos`, `categorias_gasto` y `cuentas`
-- pensando en un módulo de gastos. Mirando la operación real resultó ser otra
-- cosa: una CAJA. Entran ingresos (los cambios de dólares que la fondean),
-- salen egresos, y lo que importa es el saldo al momento, que es con lo que
-- se hace el arqueo.
--
-- Por eso las tablas se renombran en vez de convivir con nombres que mienten.
-- Estaban todas vacías.
--
-- Sobre el saldo: el archivo de Ninox tiene una columna "SALDO ACUMULADO" que
-- se recalcula fila por fila. Es el anti-ejemplo que CLAUDE.md nombra por su
-- nombre. Acá el saldo sale de dos funciones que hacen UNA agregación cada
-- una, y el saldo renglón por renglón se arma sobre el período que se está
-- mirando, no sobre toda la historia.

create type caja_tipo as enum ('ingreso', 'egreso');

alter table gastos rename to movimientos_caja;
alter table categorias_gasto rename to categorias_movimiento;
alter table liquidacion_lineas rename column gasto_id to movimiento_id;

-- Las cuentas no se usan: la plata sale de un solo lugar (decisión del
-- dueño). La tabla estaba vacía.
alter table movimientos_caja drop column cuenta_id;
drop table cuentas;

-- La columna suelta de comprobante se reemplaza por una tabla: un movimiento
-- puede tener la factura y el comprobante de la transferencia.
alter table movimientos_caja drop column comprobante;

alter table movimientos_caja
  add column tipo caja_tipo not null default 'egreso',
  -- Solo tiene sentido sobre un movimiento de un departamento: es plata que
  -- puso MTHosting y el propietario devuelve.
  add column reembolsable boolean not null default false,
  -- Sin fecha de cobro, el reembolsable está pendiente. Con fecha, cobrado.
  add column fecha_cobro date,
  add column forma_cobro text,
  add column notas_cobro text;

alter table movimientos_caja
  alter column fecha set not null,
  alter column monto set not null,
  alter column moneda set default 'ARS';

alter table movimientos_caja
  add constraint caja_monto_positivo check (monto > 0),
  -- El signo lo da `tipo`, no el monto: un egreso no se guarda en negativo.
  add constraint caja_reembolsable_con_depto
    check (not reembolsable or depto_id is not null),
  add constraint caja_cobro_solo_si_reembolsable
    check (fecha_cobro is null or reembolsable);

create index idx_caja_fecha on movimientos_caja (fecha);
create index idx_caja_depto on movimientos_caja (depto_id);
create index idx_caja_categoria on movimientos_caja (categoria_id);
-- Los reembolsables sin cobrar son la consulta que más se va a hacer.
create index idx_caja_por_cobrar on movimientos_caja (fecha_cobro)
  where activo and reembolsable;

create table movimiento_comprobantes (
  id uuid primary key default gen_random_uuid(),
  movimiento_id uuid not null references movimientos_caja (id),
  storage_path text not null,
  -- Baja lógica, igual que la evidencia de los reclamos.
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_movimiento_comprobantes on movimiento_comprobantes (movimiento_id);

create trigger audit_movimientos_caja
  after insert or update or delete on movimientos_caja
  for each row execute function audit_trigger();
create trigger audit_cotizaciones after insert or update or delete on cotizaciones
  for each row execute function audit_trigger();
create trigger audit_movimiento_comprobantes
  after insert or update or delete on movimiento_comprobantes
  for each row execute function audit_trigger();

create trigger updated_at_movimiento_comprobantes before update on movimiento_comprobantes
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Saldo. Una agregación, no un recorrido.
-- ----------------------------------------------------------------------------

/** Saldo de la caja hasta una fecha inclusive. Sin fecha, el saldo de hoy. */
create or replace function saldo_caja(p_hasta date default null)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    sum(case when tipo = 'ingreso' then monto else -monto end),
    0
  )
  from movimientos_caja
  where activo
    and (p_hasta is null or fecha <= p_hasta);
$$;

/** Saldo con el que arranca un período: todo lo anterior a esa fecha. */
create or replace function saldo_caja_antes(p_fecha date)
returns numeric
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    sum(case when tipo = 'ingreso' then monto else -monto end),
    0
  )
  from movimientos_caja
  where activo and fecha < p_fecha;
$$;

-- ----------------------------------------------------------------------------
-- Permisos: solo manager y administración (decisión del dueño, 11/08/2026).
-- Es la primera pantalla con la plata de la operación adentro, así que se
-- cierra en la base y no solo en la pantalla.
-- ----------------------------------------------------------------------------

create or replace function puede_ver_caja()
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

alter table movimiento_comprobantes enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array[
    'movimientos_caja', 'categorias_movimiento', 'cotizaciones'
  ]
  loop
    execute format('drop policy if exists autenticados_todo on %I', t);
    execute format(
      'create policy %1$s_solo_manager on %1$I
         for all to authenticated
         using (puede_ver_caja()) with check (puede_ver_caja())', t);
  end loop;
end;
$$;

create policy movimiento_comprobantes_solo_manager on movimiento_comprobantes
  for all to authenticated
  using (puede_ver_caja())
  with check (puede_ver_caja());

insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', false)
on conflict (id) do nothing;

create policy comprobantes_storage on storage.objects
  for all to authenticated
  using (bucket_id = 'comprobantes' and puede_ver_caja())
  with check (bucket_id = 'comprobantes' and puede_ver_caja());
