-- "Dejé la llave" con la hora REAL en que se dejó (decisión del dueño,
-- 14/10/2026).
--
-- La foto de la llave ahora se guarda en el celular si no hay señal y sube
-- sola cuando vuelve. Con la función anterior la hora marcada era la de la
-- subida: una llave dejada a las 10:00 en un sótano sin señal aparecía como
-- dejada a las 13:00, y la oficina no tenía forma de saberlo.
--
-- Ahora el celular manda el momento en que se sacó la foto. Se acepta solo
-- si es creíble: no en el futuro y no más vieja que tres días (lo que puede
-- durar, como mucho, una foto esperando señal). Si no, vale la hora de
-- llegada al servidor, como antes.

drop function if exists logistica_dejar_llave(uuid, text);

create or replace function logistica_dejar_llave(
  p_evento uuid,
  p_foto text,
  p_cuando timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cuando timestamptz := now();
begin
  if not puede_hacer_logistica() then
    raise exception 'Tu rol no puede marcar la llave.';
  end if;
  if coalesce(trim(p_foto), '') = '' then
    raise exception 'Falta la foto de la llave en el candado.';
  end if;

  if p_cuando is not null and p_cuando <= now() and p_cuando > now() - interval '3 days' then
    v_cuando := p_cuando;
  end if;

  update eventos_estadia
     set acceso_dejado = true,
         acceso_dejado_at = v_cuando,
         acceso_dejado_por = auth.uid(),
         acceso_foto = p_foto
   where id = p_evento
     and tipo = 'checkin';

  if not found then
    raise exception 'No se encontró la llegada.';
  end if;
end;
$$;

revoke execute on function logistica_dejar_llave(uuid, text, timestamptz) from anon, public;
grant execute on function logistica_dejar_llave(uuid, text, timestamptz) to authenticated;
