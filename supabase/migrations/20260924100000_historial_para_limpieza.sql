-- ============================================================================
-- Lo que la limpiadora necesita saber de las limpiezas ANTERIORES del depto,
-- aunque las haya hecho otra persona (decisión del dueño, 24/09/2026).
--
-- RLS le deja ver solo sus limpiezas (20260825100000_rls_limpieza.sql). Eso
-- está bien para la lista, pero le escondía tres cosas de su propio trabajo:
--   - "días sin limpiarse", si la última vez fue otra;
--   - la nota "para la próxima vez" que dejó quien limpió antes, que es
--     justamente para ella;
--   - hace cuánto se hizo cada tarea periódica, que marcaba vencida una
--     tarea que otra persona había hecho la semana pasada.
--
-- Estas funciones corren con los permisos del dueño y devuelven SOLO eso
-- (fechas y la nota), y solo para limpiezas que quien pregunta puede ver.
-- ============================================================================

-- ¿Quien pregunta puede ver esta limpieza? La misma regla que la política
-- `limpiezas_lectura`, más: sin rol (baja o sin ficha), nada.
create or replace function puede_ver_limpieza(p_asignado_a uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select mi_rol() is not null
     and (mi_rol() <> 'limpieza' or p_asignado_a = mi_persona_id());
$$;

-- La limpieza anterior (hecha o verificada) del mismo depto, para cada una
-- de las pedidas. Una sola consulta para toda la lista de "Mis limpiezas".
create or replace function limpiezas_anteriores(p_ids uuid[])
returns table (limpieza_id uuid, fecha date, observacion_proxima text)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, previa.fecha, previa.observacion_proxima
  from limpiezas l
  cross join lateral (
    select a.fecha, a.observacion_proxima
    from limpiezas a
    where a.depto_id = l.depto_id
      and a.estado in ('hecha', 'verificada')
      and a.fecha < l.fecha
      and a.id <> l.id
    order by a.fecha desc, a.created_at desc
    limit 1
  ) previa
  where l.id = any(p_ids)
    and puede_ver_limpieza(l.asignado_a);
$$;

-- La última vez que se hizo cada tarea periódica en el depto de esta
-- limpieza, hasta su fecha y sin contarla a ella.
create or replace function periodicas_del_depto(p_limpieza_id uuid)
returns table (tarea_periodica_id uuid, fecha date)
language sql
stable
security definer
set search_path = public
as $$
  select c.tarea_periodica_id, max(a.fecha)
  from limpiezas l
  join limpiezas a on a.depto_id = l.depto_id
                  and a.fecha <= l.fecha
                  and a.id <> l.id
  join limpieza_checklist c on c.limpieza_id = a.id
  where l.id = p_limpieza_id
    and puede_ver_limpieza(l.asignado_a)
    and c.tarea_periodica_id is not null
    and c.hecho
    and c.activo
  group by c.tarea_periodica_id;
$$;

revoke all on function puede_ver_limpieza(uuid) from public, anon;
revoke all on function limpiezas_anteriores(uuid[]) from public, anon;
revoke all on function periodicas_del_depto(uuid) from public, anon;
grant execute on function puede_ver_limpieza(uuid) to authenticated;
grant execute on function limpiezas_anteriores(uuid[]) to authenticated;
grant execute on function periodicas_del_depto(uuid) to authenticated;
