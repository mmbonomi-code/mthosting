-- ============================================================================
-- El checklist de una limpieza no puede tener el mismo ítem dos veces.
--
-- Se genera la primera vez que se abre la limpieza: se fija si hay filas y,
-- si no hay, las crea. Dos cargas casi simultáneas de la pantalla (pasa en
-- el celular) veían las dos "no hay" y creaban las dos: 12 limpiezas con el
-- checklist entero repetido al 18/09/2026, 380 filas de más.
--
-- Las copias no se borran (bajas lógicas, CLAUDE.md): quedan con
-- activo = false. De cada par se conserva la primera, y si la persona tildó
-- la otra copia, el tilde se pasa a la que queda.
-- ============================================================================

alter table limpieza_checklist
  add column activo boolean not null default true;

-- 1. El tilde de cualquier copia pasa a la primera.
with grupos as (
  select id,
         row_number() over (partition by limpieza_id, seccion, item order by created_at, id) as orden,
         bool_or(hecho) over (partition by limpieza_id, seccion, item) as alguna_hecha
    from limpieza_checklist
)
update limpieza_checklist c
   set hecho = true
  from grupos g
 where g.id = c.id
   and g.orden = 1
   and g.alguna_hecha
   and not c.hecho;

-- 2. Las copias quedan dadas de baja.
with grupos as (
  select id,
         row_number() over (partition by limpieza_id, seccion, item order by created_at, id) as orden
    from limpieza_checklist
)
update limpieza_checklist c
   set activo = false
  from grupos g
 where g.id = c.id
   and g.orden > 1;

-- 3. Y no vuelve a pasar: la segunda carga choca contra esto y no inserta.
create unique index limpieza_checklist_item_unico
  on limpieza_checklist (limpieza_id, seccion, item)
  where activo;
