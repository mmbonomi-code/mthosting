-- Desde cuándo MTHosting administra cada departamento.
--
-- Los exports de Airbnb traen la historia completa del anuncio, también la de
-- antes de que el depto entrara en gestión. Esas reservas no son nuestras y
-- no tienen que sumar a ningún número. Caso que lo originó: HONDURAS 1, que
-- entró el 13/03/2026 y traía dos reservas de enero y febrero cobradas
-- directo por la propietaria (decisión del dueño, 03/10/2026).
--
-- Regla: un movimiento del depto cuya estadía empieza antes de
-- `en_gestion_desde` queda fuera de gestión. Un payout queda fuera cuando
-- TODAS las filas de su grupo están fuera: si mezcla una reserva nuestra, se
-- queda.
--
-- Las filas no se borran (CLAUDE.md regla 3): quedan con `activo = false` y
-- `fuera_de_gestion = true`. La marca aparte es lo que permite volver atrás
-- si la fecha se corrige, sin confundirlas con las de un lote deshecho.

alter table departamentos add column en_gestion_desde date;

comment on column departamentos.en_gestion_desde is
  'Desde qué día administra MTHosting el depto. Lo anterior no cuenta en el económico. Null = sin límite.';

alter table movimientos_economicos
  add column fuera_de_gestion boolean not null default false;

-- El importador las busca para no volver a cargarlas.
create index idx_movimientos_economicos_fuera_de_gestion
  on movimientos_economicos (huella) where fuera_de_gestion;

-- ----------------------------------------------------------------------------

create or replace function aplicar_en_gestion_desde(p_depto uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desde date;
begin
  -- La puerta de verdad: el económico es solo de administración. Sin sesión
  -- (scripts con service_role) pasa.
  if auth.uid() is not null and not puede_ver_economico() then
    raise exception 'Solo administración puede cambiar desde cuándo se gestiona un departamento.';
  end if;

  select en_gestion_desde into v_desde from departamentos where id = p_depto;

  -- 1. Las filas de detalle del depto.
  update movimientos_economicos
     set activo = false, fuera_de_gestion = true
   where depto_id = p_depto
     and activo
     and not es_payout
     and v_desde is not null
     and coalesce(fecha_inicio, fecha) < v_desde;

  -- Las que con la fecha nueva vuelven a ser nuestras. Si mientras tanto
  -- entró otra igual (no debería: el importador las saltea), se deja.
  update movimientos_economicos m
     set activo = true, fuera_de_gestion = false
   where m.depto_id = p_depto
     and m.fuera_de_gestion
     and not m.es_payout
     and (v_desde is null or coalesce(m.fecha_inicio, m.fecha) >= v_desde)
     and not exists (
       select 1 from movimientos_economicos o
        where o.huella = m.huella and o.activo
     );

  -- 2. Los payouts de los grupos que tocan este depto. El grupo se numera
  -- dentro de cada archivo de cada lote.
  with grupos as (
    select distinct import_id, archivo, grupo_payout
      from movimientos_economicos
     where depto_id = p_depto and grupo_payout is not null
  ),
  estado as (
    select g.import_id, g.archivo, g.grupo_payout,
           bool_and(m.fuera_de_gestion) as todo_fuera
      from grupos g
      join movimientos_economicos m
        on m.import_id = g.import_id
       and m.archivo = g.archivo
       and m.grupo_payout = g.grupo_payout
       and not m.es_payout
       and (m.activo or m.fuera_de_gestion)
     group by 1, 2, 3
  )
  update movimientos_economicos p
     set activo = not e.todo_fuera,
         fuera_de_gestion = e.todo_fuera
    from estado e
   where p.import_id = e.import_id
     and p.archivo = e.archivo
     and p.grupo_payout = e.grupo_payout
     and p.es_payout
     and (p.activo or p.fuera_de_gestion)
     and p.fuera_de_gestion is distinct from e.todo_fuera;
end;
$$;

create or replace function trg_en_gestion_desde()
returns trigger
language plpgsql
as $$
begin
  perform aplicar_en_gestion_desde(new.id);
  return new;
end;
$$;

create trigger en_gestion_desde_cambio
  after update of en_gestion_desde on departamentos
  for each row
  when (old.en_gestion_desde is distinct from new.en_gestion_desde)
  execute function trg_en_gestion_desde();
