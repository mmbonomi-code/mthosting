-- ============================================================================
-- El orden de los puntos de acceso lo decide el usuario: los que más se usan
-- van arriba en el desplegable de coordinación.
-- ============================================================================

alter table puntos_acceso add column orden integer not null default 0;

-- Los que ya existen arrancan en el orden alfabético actual, para que la
-- lista no cambie sola al aplicar esto.
with numerados as (
  select id, row_number() over (order by ubicacion, identificador) * 10 as posicion
  from puntos_acceso
)
update puntos_acceso p
   set orden = n.posicion
  from numerados n
 where n.id = p.id;

create index idx_puntos_acceso_orden on puntos_acceso (orden);
