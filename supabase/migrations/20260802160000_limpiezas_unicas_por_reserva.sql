-- ============================================================================
-- Generación automática de limpiezas (spec §2.8).
--
-- Una reserva tiene como mucho UNA limpieza por rol (salida / entrada), así
-- que reimportar el mismo archivo no puede duplicarlas. Las limpiezas
-- manuales (sin reserva) no entran en la restricción: de esas puede haber
-- todas las que haga falta.
-- ============================================================================

create unique index limpiezas_unica_por_reserva_rol
  on limpiezas (reserva_id, rol_reserva)
  where reserva_id is not null;

-- Se consultan por departamento y fecha para calcular la ventana disponible
-- y el próximo check-in.
create index idx_reservas_depto_checkout on reservas (depto_id, fecha_checkout);
