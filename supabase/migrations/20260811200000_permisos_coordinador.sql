-- Back office es el rol coordinador (decisión del dueño, 11/08/2026).
--
-- Reclamos y Reporte se habían atado a la casilla `personas.es_backoffice`,
-- que existía desde la migración inicial. Resulta que "back office" y
-- "coordinador" son la misma cosa, así que tener las dos formas de dar
-- permiso era tener dos sistemas en paralelo para lo mismo.
--
-- Desde acá el permiso sale SOLO del rol: admin, manager y coordinador.
-- La casilla queda en la tabla con los valores que tiene —no se borra nada—
-- pero deja de decidir quién entra a qué.
--
-- El resto de los permisos por rol se endurece en la Fase 2, como estaba
-- planeado (CLAUDE.md, § Seguridad).

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
       and p.rol in ('admin', 'manager', 'coordinador')
  );
$$;

create or replace function puede_escribir_reporte()
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
       and p.rol in ('admin', 'manager', 'coordinador')
  );
$$;
