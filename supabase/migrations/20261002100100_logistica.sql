-- ============================================================================
-- Logística (decisión del dueño, 02/10/2026): lo que marca y lo que no.
--
-- Ve, del día: las limpiezas con su horario de salida y de entrada (para la
-- ropa blanca), las llegadas con candado, las cunas y sillas que hay que
-- llevar o retirar, y los pendientes del reporte que tiene a su nombre.
--
-- Marca:
--   - en cada limpieza, "dejé lo blanco" y "saqué lo sucio";
--   - en cada llegada con candado, "dejé la llave", con una foto;
--   - en cada cuna o silla, entregada / retirada.
--
-- Los pendientes del reporte los LEE: los cierra el back office.
--
-- Todo lo que marca pasa por las funciones de abajo, que tocan SOLO esas
-- columnas. Escribir directo en cualquier tabla le queda cerrado por una
-- política restrictiva: así logística no puede, por ejemplo, reasignar una
-- limpieza o editar una reserva aunque arme el pedido a mano.
--
-- La lectura sigue abierta a cualquier usuario autenticado, como en el resto
-- de la Fase 1: lo que no tiene que ver lo recorta la pantalla.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Columnas nuevas. Quién y cuándo, no un tilde suelto: si falta una sábana,
-- se sabe quién la llevó y a qué hora.
-- ----------------------------------------------------------------------------

alter table limpiezas
  add column blanco_entregado_at timestamptz,
  add column blanco_entregado_por uuid references personas (id),
  add column sucio_retirado_at timestamptz,
  add column sucio_retirado_por uuid references personas (id);

alter table eventos_estadia
  add column acceso_dejado_at timestamptz,
  add column acceso_dejado_por uuid references personas (id),
  -- Ruta en el bucket `logistica`: la foto de la llave en el candado.
  add column acceso_foto text;

-- ----------------------------------------------------------------------------
-- Las fotos de la llave. Bucket privado, mismo criterio que el de limpiezas:
-- se sirve siempre por URL firmada generada en el servidor.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('logistica', 'logistica', false)
on conflict (id) do nothing;

create policy logistica_storage_autenticados on storage.objects
  for all to authenticated
  using (bucket_id = 'logistica')
  with check (bucket_id = 'logistica');

-- ----------------------------------------------------------------------------
-- Quién hace logística: la persona de logística y el back office, que la
-- cubre cuando falta.
-- ----------------------------------------------------------------------------

create or replace function puede_hacer_logistica()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(mi_rol() in ('admin', 'manager', 'coordinador', 'logistica'), false);
$$;

-- Ropa blanca: `p_que` es 'blanco' o 'sucio'. Con `p_valor` falso se
-- deshace (un toque equivocado no tiene que quedar para siempre).
create or replace function logistica_marcar_ropa(p_limpieza uuid, p_que text, p_valor boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not puede_hacer_logistica() then
    raise exception 'Tu rol no puede marcar la ropa blanca.';
  end if;

  if p_que = 'blanco' then
    update limpiezas
       set blanco_entregado_at = case when p_valor then now() end,
           blanco_entregado_por = case when p_valor then mi_persona_id() end
     where id = p_limpieza;
  elsif p_que = 'sucio' then
    update limpiezas
       set sucio_retirado_at = case when p_valor then now() end,
           sucio_retirado_por = case when p_valor then mi_persona_id() end
     where id = p_limpieza;
  else
    raise exception 'Marca de ropa desconocida: %', p_que;
  end if;

  if not found then
    raise exception 'No se encontró la limpieza.';
  end if;
end;
$$;

-- La llave quedó en el candado. La foto es obligatoria: es la prueba de que
-- se dejó, y lo que se mira si el huésped dice que no la encuentra.
create or replace function logistica_dejar_llave(p_evento uuid, p_foto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not puede_hacer_logistica() then
    raise exception 'Tu rol no puede marcar la llave.';
  end if;
  if coalesce(trim(p_foto), '') = '' then
    raise exception 'Falta la foto de la llave en el candado.';
  end if;

  update eventos_estadia
     set acceso_dejado = true,
         acceso_dejado_at = now(),
         acceso_dejado_por = mi_persona_id(),
         acceso_foto = p_foto
   where id = p_evento
     and tipo = 'checkin';

  if not found then
    raise exception 'No se encontró la llegada.';
  end if;
end;
$$;

-- Deshacer "dejé la llave". La foto anterior queda en el audit_log y en el
-- bucket; acá se limpia para que no parezca que la nueva marca tiene foto.
create or replace function logistica_deshacer_llave(p_evento uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not puede_hacer_logistica() then
    raise exception 'Tu rol no puede marcar la llave.';
  end if;

  update eventos_estadia
     set acceso_dejado = false,
         acceso_dejado_at = null,
         acceso_dejado_por = null,
         acceso_foto = null
   where id = p_evento
     and tipo = 'checkin';

  if not found then
    raise exception 'No se encontró la llegada.';
  end if;
end;
$$;

-- Cunas y sillas: solo el estado. Crear, mover o archivar un pedido sigue
-- siendo del back office.
create or replace function logistica_marcar_equipamiento(p_id uuid, p_estado equipamiento_estado)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not puede_hacer_logistica() then
    raise exception 'Tu rol no puede marcar cunas ni sillas.';
  end if;

  update equipamiento_bebe
     set estado = p_estado
   where id = p_id
     and activo;

  if not found then
    raise exception 'No se encontró el pedido.';
  end if;
end;
$$;

revoke execute on function logistica_marcar_ropa(uuid, text, boolean) from anon, public;
revoke execute on function logistica_dejar_llave(uuid, text) from anon, public;
revoke execute on function logistica_deshacer_llave(uuid) from anon, public;
revoke execute on function logistica_marcar_equipamiento(uuid, equipamiento_estado) from anon, public;
grant execute on function logistica_marcar_ropa(uuid, text, boolean) to authenticated;
grant execute on function logistica_dejar_llave(uuid, text) to authenticated;
grant execute on function logistica_deshacer_llave(uuid) to authenticated;
grant execute on function logistica_marcar_equipamiento(uuid, equipamiento_estado) to authenticated;

-- ----------------------------------------------------------------------------
-- Logística no escribe directo en ninguna tabla.
--
-- Una política RESTRICTIVA se suma con AND a las que ya hay: el resto de los
-- roles sigue exactamente igual, y logística queda en solo lectura. Las
-- funciones de arriba corren con los permisos del dueño, así que no las
-- frena. El audit_log tampoco: lo escribe un trigger `security definer`.
--
-- OJO: alcanza a las tablas que existen hoy. Una tabla nueva que logística
-- no deba escribir necesita su propia política (o volver a correr este
-- bloque).
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables where schemaname = 'public' and rowsecurity
  loop
    execute format(
      'create policy logistica_no_inserta on %I as restrictive for insert to authenticated
         with check (mi_rol() is distinct from ''logistica'')', t);
    execute format(
      'create policy logistica_no_modifica on %I as restrictive for update to authenticated
         using (mi_rol() is distinct from ''logistica'')', t);
    execute format(
      'create policy logistica_no_borra on %I as restrictive for delete to authenticated
         using (mi_rol() is distinct from ''logistica'')', t);
  end loop;
end;
$$;
