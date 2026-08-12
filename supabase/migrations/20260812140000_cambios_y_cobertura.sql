-- Cambios de moneda y cobertura de los gastos (decisiones del dueño, 12/08/2026).
--
-- La plata de la caja entra, en su mayoría, cambiando dólares a pesos. Cada
-- cambio es una BOLSA de pesos con un costo conocido en dólares: 1.430
-- dólares a 1.200 son 1.716.000 pesos que "valen" esos 1.430.
--
-- Los gastos van consumiendo bolsas en orden de llegada. Un gasto se valúa en
-- dólares por las bolsas que consumió, no por el dólar del día: es el costo
-- real de esa plata. Un gasto puede partirse entre dos bolsas.
--
-- Reglas acordadas:
--   * Pesos que NO vinieron de un cambio (una devolución de propietario, una
--     diferencia de caja) no tienen costo en dólares: esos gastos se valúan
--     al dólar del día en que se hicieron.
--   * Si un día se gastó más de lo que había, lo descubierto lo cubre el
--     cambio siguiente. Pasa cuando el cambio se registra un día tarde.

alter table categorias_movimiento
  add column es_cambio boolean not null default false;

comment on column categorias_movimiento.es_cambio is
  'Los ingresos de esta categoría son cambios de moneda: se cargan en dólares y tipo de cambio, y los pesos se calculan.';

alter table movimientos_caja
  -- Solo en los ingresos de una categoría de cambio.
  add column usd_cambiado numeric check (usd_cambiado is null or usd_cambiado > 0),
  add column tc_cambio numeric check (tc_cambio is null or tc_cambio > 0);

-- Los dos van juntos o ninguno: media carga no sirve para valuar nada.
alter table movimientos_caja
  add constraint caja_cambio_completo
    check ((usd_cambiado is null) = (tc_cambio is null));

/**
 * Qué bolsa pagó cada peso de cada gasto.
 *
 * Se guarda calculado en vez de rehacerse en cada pantalla: el reparto
 * depende de TODA la historia anterior, así que recalcularlo al vuelo sería
 * el mismo recorrido que CLAUDE.md prohíbe.
 */
create table movimiento_cobertura (
  id uuid primary key default gen_random_uuid(),
  -- El gasto que se está cubriendo.
  movimiento_id uuid not null references movimientos_caja (id) on delete cascade,
  -- El ingreso que lo cubre. Null solo si quedó descubierto.
  origen_id uuid references movimientos_caja (id) on delete cascade,
  monto numeric not null check (monto > 0),
  -- El tipo de cambio de esa bolsa. Null cuando la plata no vino de un
  -- cambio: ahí manda el dólar del día del gasto.
  tc numeric check (tc is null or tc > 0),
  created_at timestamptz not null default now()
);

create index idx_cobertura_movimiento on movimiento_cobertura (movimiento_id);
create index idx_cobertura_origen on movimiento_cobertura (origen_id);

alter table movimiento_cobertura enable row level security;

create policy cobertura_solo_manager on movimiento_cobertura
  for all to authenticated
  using (puede_ver_caja())
  with check (puede_ver_caja());

-- La categoría con la que entra casi toda la plata.
update categorias_movimiento set es_cambio = true where nombre = 'CAMBIO URVA';
