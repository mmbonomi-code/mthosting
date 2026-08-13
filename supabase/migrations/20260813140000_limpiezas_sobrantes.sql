-- Limpieza de las limpiezas que sobran (decisiones del dueño, 13/08/2026).
--
-- Las reglas nuevas de generación arreglan lo que se calcule de acá en
-- adelante, pero lo que ya está guardado no se toca solo: la generación corre
-- sobre las reservas de cada importación, y muchas de estas cuelgan de
-- reservas que no se van a volver a importar. Se corrige de una vez, acá.
--
-- Solo se tocan las limpiezas `pendiente` y `asignada`. Una que ya está en
-- curso, hecha o verificada NO se toca ni acá ni en ningún lado: si alguien
-- ya trabajó, eso lo decide una persona.

-- ----------------------------------------------------------------------------
-- 1. Limpiezas de reservas canceladas o descartadas.
--
-- Hasta ahora, si la cancelación llegaba con la estadía "en curso", la
-- limpieza se dejaba viva a propósito, por si el huésped seguía adentro. En la
-- práctica son reservas tentativas del calendario que se caen, y quedaba una
-- limpieza fantasma en la lista sin ninguna marca de que la reserva ya no
-- existía. Va primero: libera el día para la limpieza que sí corresponde.
-- ----------------------------------------------------------------------------

update limpiezas l
   set estado = 'cancelada'
  from reservas r
 where l.reserva_id = r.id
   and (r.cancelada or r.descartada)
   and l.estado in ('pendiente', 'asignada');

-- ----------------------------------------------------------------------------
-- 2. Repasos que ya no corresponden.
--
-- El repaso existe para el huésped que entra a un departamento sin que haya
-- habido una salida antes. Se generaban de más por dos motivos:
--
--   a) Un bloqueo del calendario de Airbnb los disparaba. Airbnb marca como
--      "no disponible" el propio día de recambio, así que casi toda reserva
--      se llevaba un repaso al pedo.
--   b) Cuando el motivo desaparecía —por ejemplo, después se importaba la
--      reserva anterior que faltaba— el repaso quedaba pegado, porque el
--      código solo sabía crearlos, nunca sacarlos.
--
-- Se cancelan los que hoy tienen una salida anterior que los cubre.
-- ----------------------------------------------------------------------------

update limpiezas l
   set estado = 'cancelada'
  from reservas r
 where l.reserva_id = r.id
   and l.rol_reserva = 'entrada'
   and l.estado in ('pendiente', 'asignada')
   and exists (
     select 1
       from reservas previa
      where previa.depto_id = l.depto_id
        and previa.id <> r.id
        and not previa.cancelada
        and not previa.descartada
        and previa.fecha_checkout is not null
        and previa.fecha_checkout <= r.fecha_checkin
   );

-- ----------------------------------------------------------------------------
-- Lo que queda con dos limpiezas el mismo día NO se toca.
--
-- Después de lo de arriba sobreviven los casos que necesitan una decisión
-- humana: dos reservas pisadas en el mismo departamento, o una limpieza
-- cargada a mano encima de la automática. Elegir cuál se cancela no es
-- mecánico, así que aparecen marcadas en la pantalla de limpiezas para que
-- las resuelva una persona.
-- ----------------------------------------------------------------------------

do $$
declare
  duplicados integer;
begin
  select count(*) into duplicados
    from (
      select depto_id, fecha
        from limpiezas
       where estado <> 'cancelada'
       group by depto_id, fecha
      having count(*) > 1
    ) d;
  raise notice 'Dias con mas de una limpieza que quedan para revisar a mano: %', duplicados;
end;
$$;
