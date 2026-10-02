-- Quién marcó lo de logística: el USUARIO, no la persona.
--
-- La migración anterior colgó `blanco_entregado_por`, `sucio_retirado_por` y
-- `acceso_dejado_por` de `personas`. Eso le dio a `limpiezas` tres caminos a
-- `personas`, y todas las consultas que piden `responsable:personas(nombre)`
-- (Semana, el PDF del día, la ficha de la limpieza, alertas) dejan de saber
-- cuál usar y fallan.
--
-- Se usa el mismo criterio que `notas_reporte.hecho_por`: el usuario de
-- Auth, que la API no expone y por lo tanto no compite con el responsable.

alter table limpiezas drop constraint limpiezas_blanco_entregado_por_fkey;
alter table limpiezas drop constraint limpiezas_sucio_retirado_por_fkey;
alter table eventos_estadia drop constraint eventos_estadia_acceso_dejado_por_fkey;

-- Recién agregadas: no hay marcas que convertir, pero por las dudas se
-- vacían antes de cambiar a qué apuntan.
update limpiezas set blanco_entregado_por = null where blanco_entregado_por is not null;
update limpiezas set sucio_retirado_por = null where sucio_retirado_por is not null;
update eventos_estadia set acceso_dejado_por = null where acceso_dejado_por is not null;

alter table limpiezas
  add constraint limpiezas_blanco_entregado_por_fkey
    foreign key (blanco_entregado_por) references auth.users (id),
  add constraint limpiezas_sucio_retirado_por_fkey
    foreign key (sucio_retirado_por) references auth.users (id);

alter table eventos_estadia
  add constraint eventos_estadia_acceso_dejado_por_fkey
    foreign key (acceso_dejado_por) references auth.users (id);

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
           blanco_entregado_por = case when p_valor then auth.uid() end
     where id = p_limpieza;
  elsif p_que = 'sucio' then
    update limpiezas
       set sucio_retirado_at = case when p_valor then now() end,
           sucio_retirado_por = case when p_valor then auth.uid() end
     where id = p_limpieza;
  else
    raise exception 'Marca de ropa desconocida: %', p_que;
  end if;

  if not found then
    raise exception 'No se encontró la limpieza.';
  end if;
end;
$$;

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
         acceso_dejado_por = auth.uid(),
         acceso_foto = p_foto
   where id = p_evento
     and tipo = 'checkin';

  if not found then
    raise exception 'No se encontró la llegada.';
  end if;
end;
$$;
