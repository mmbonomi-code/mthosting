-- ============================================================================
-- Ajustes pedidos por el dueño (01/08/2026):
--
-- 1. BAÑOS: dejan de ser tres campos de texto fijos. Pasan a tabla propia,
--    para agregar los que haga falta y elegir el tipo de cada uno
--    (completo con bañera / completo con ducha / toilette).
-- 2. Laundry y Estacionamiento se mueven al grupo "Edificio".
-- 3. La velocidad de wifi deja de ser un ítem de equipamiento: es un campo
--    del departamento, al lado de la clave de wifi.
-- ============================================================================

-- --- 1. Baños como tabla propia ---------------------------------------------

create type tipo_bano as enum
  ('completo_banera', 'completo_ducha', 'toilette');

create table banos_depto (
  id uuid primary key default gen_random_uuid(),
  depto_id uuid not null references departamentos (id),
  tipo tipo_bano not null,
  detalle text,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_banos_depto on banos_depto (depto_id);

alter table banos_depto enable row level security;
create policy autenticados_todo on banos_depto
  for all to authenticated using (true) with check (true);

create trigger audit_banos_depto
  after insert or update or delete on banos_depto
  for each row execute function audit_trigger();

create trigger updated_at_banos_depto
  before update on banos_depto
  for each row execute function set_updated_at();

-- Se conserva lo ya cargado: el texto original va a `detalle` y el tipo se
-- deduce por palabra clave. Lo que no se pueda deducir queda como
-- 'completo_ducha' con su texto intacto, para revisarlo a mano.
insert into banos_depto (depto_id, tipo, detalle, orden)
select
  d.id,
  case
    when b.texto ilike '%bañera%' or b.texto ilike '%banera%' then 'completo_banera'::tipo_bano
    when b.texto ilike '%toilet%' then 'toilette'::tipo_bano
    else 'completo_ducha'::tipo_bano
  end,
  b.texto,
  b.orden
from departamentos d
cross join lateral (
  values (d.bano_1, 1), (d.bano_2, 2), (d.bano_3, 3)
) as b(texto, orden)
where b.texto is not null;

alter table departamentos
  drop column cantidad_banos,
  drop column bano_1,
  drop column bano_2,
  drop column bano_3;

-- --- 2. Laundry y Estacionamiento pasan a Edificio ---------------------------

update item_catalogo set categoria = 'Edificio', orden = 40
  where nombre = 'Laundry';
update item_catalogo set categoria = 'Edificio', orden = 50
  where nombre = 'Estacionamiento';

-- --- 3. Velocidad de wifi: campo del departamento, no ítem -------------------

alter table departamentos add column wifi_velocidad text;

delete from inventario_depto
  where item_id in (select id from item_catalogo where nombre = 'Velocidad de wifi');
delete from item_catalogo where nombre = 'Velocidad de wifi';
