-- Dos departamentos con el MISMO calendario de Airbnb (13/08/2026).
--
-- QUÉ PASÓ
--
-- RODRIGUEZ PEÑA 2 y GOLFARINI 1 tenían cargada la misma `ical_url`. Es el
-- calendario de GOLFARINI 1: sus reservas traen el anuncio "departamento en
-- la zona de belgrano", y RODRIGUEZ PEÑA está en Recoleta.
--
-- La sincronización le cree a la `ical_url`: cada reserva que encuentra en un
-- calendario se guarda con el departamento DUEÑO de esa dirección. No tiene
-- con qué desconfiar — un calendario de Airbnb no dice a qué anuncio
-- pertenece, sus eventos son "Reserved" y "Airbnb (Not available)".
--
-- Así que el mismo calendario se leía dos veces, una por cada departamento, y
-- cada reserva quedaba en el que se procesara primero. Por eso HMTFZ35CXX,
-- que es de GOLFARINI 1, terminó archivada en RODRIGUEZ PEÑA 2.
--
-- Efecto secundario, igual de importante: RODRIGUEZ PEÑA 2 no estaba
-- sincronizando su propio calendario, porque tenía cargado el ajeno.
--
-- (Es el mismo mecanismo por el que 23 reservas de ED TALC 07 aparecieron en
-- QUARTIER 1, pero aquel caso lo provocaba la prueba automática cambiando la
-- dirección a propósito. Este es la operación real.)

-- ----------------------------------------------------------------------------
-- 1. La dirección equivocada se borra.
--
-- No se adivina cuál es la buena: queda vacía y se carga a mano desde la ficha
-- del departamento. Vacía es mejor que ajena — vacía no sincroniza, ajena
-- ensucia otro departamento en cada corrida.
-- ----------------------------------------------------------------------------

update departamentos
   set ical_url = null,
       ical_ultima_sync = null,
       observacion = concat_ws(
         E'\n',
         nullif(observacion, ''),
         'El calendario de Airbnb estaba cargado con el de GOLFARINI 1 y se borro el 13/08/2026. Falta cargar el propio.'
       )
 where codigo = 'RODRIGUEZ PEÑA 2';

-- ----------------------------------------------------------------------------
-- 2. La reserva vuelve a su departamento, con su limpieza.
--
-- Se mueven las dos juntas: una limpieza tiene que estar donde está la
-- reserva, o alguien va a limpiar el edificio equivocado.
-- ----------------------------------------------------------------------------

do $$
declare
  v_golfarini uuid;
  v_reserva   uuid;
  v_fecha     date;
  v_ocupado   boolean;
begin
  select id into v_golfarini from departamentos where codigo = 'GOLFARINI 1';
  select id into v_reserva from reservas where codigo_reserva = 'HMTFZ35CXX';
  if v_golfarini is null or v_reserva is null then
    raise notice 'No se encontro GOLFARINI 1 o la reserva HMTFZ35CXX: no se toca nada.';
    return;
  end if;

  select fecha into v_fecha
    from limpiezas
   where reserva_id = v_reserva and estado <> 'cancelada'
   limit 1;

  -- Un departamento no puede terminar con dos limpiezas el mismo día.
  select exists (
    select 1 from limpiezas
     where depto_id = v_golfarini and fecha = v_fecha and estado <> 'cancelada'
  ) into v_ocupado;

  update reservas set depto_id = v_golfarini where id = v_reserva;

  if v_ocupado then
    raise notice 'GOLFARINI 1 ya tiene limpieza el %: la de HMTFZ35CXX queda para revisar a mano.', v_fecha;
  else
    update limpiezas set depto_id = v_golfarini
     where reserva_id = v_reserva and estado <> 'cancelada';
  end if;
end;
$$;

-- ----------------------------------------------------------------------------
-- 3. Que no vuelva a pasar: un calendario, un departamento.
--
-- Es la regla que faltaba. Sin esto, alguien vuelve a pegar la dirección
-- equivocada en una ficha y el sistema la acepta sin decir nada, y recién se
-- nota cuando aparecen reservas ajenas semanas después.
-- ----------------------------------------------------------------------------

create unique index departamentos_ical_url_unica
  on departamentos (ical_url)
  where ical_url is not null;
