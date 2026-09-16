-- ============================================================================
-- `urgente` y `prox_checkin` de las limpiezas de salida, recalculados.
--
-- Quedaban viejos por dos caminos (16/09/2026):
--  1. Se medían desde el check-out de la reserva, no desde el día en que se
--     limpia. Una limpieza movida a mano (KENNEDY 1, del 15 al 16/09, con un
--     check-in el 16) quedaba sin marca.
--  2. Al entrar una reserva nueva se recalculaban solo sus limpiezas, no la
--     del huésped anterior, que es la que queda con alguien entrando.
--
-- El código ya hace bien las dos cosas. Esto corrige lo que quedó guardado:
-- 114 limpiezas vivas, 48 con la marca de urgente al revés.
--
-- Es un recálculo, no un dato cargado por una persona: ni `urgente` ni
-- `prox_checkin` se editan a mano en ninguna pantalla.
-- ============================================================================

update limpiezas l
   set urgente = coalesce(v.prox = l.fecha, false),
       prox_checkin = v.prox::timestamp
  from limpiezas l2
  cross join lateral (
    select min(r.fecha_checkin) as prox
      from reservas r
     where r.depto_id = l2.depto_id
       and not r.cancelada
       and not r.descartada
       and r.fecha_checkin >= l2.fecha
       and r.id is distinct from l2.reserva_id
  ) v
 where l2.id = l.id
   and l.rol_reserva = 'salida'
   and l.estado <> 'cancelada'
   and (l.urgente is distinct from coalesce(v.prox = l.fecha, false)
        or l.prox_checkin is distinct from v.prox::timestamp);
