-- ============================================================================
-- Una estadía larga puede necesitar VARIAS limpiezas con el huésped adentro.
--
-- QUÉ PASÓ (28/08/2026)
--
-- ECUADOR 1 tiene una reserva de seis meses (HM8N9SYRW9, 25/04 → 25/10). Ya
-- tenía una limpieza "durante" el 06/08, y al cargar a mano la del 26/08 la
-- base la rechazó:
--
--   duplicate key value violates unique constraint
--   "limpiezas_unica_por_reserva_rol"
--
-- El índice está bien pensado pero abarcaba de más. Existe para que reimportar
-- el mismo archivo no duplique la limpieza de SALIDA ni la de ENTRADA, que las
-- genera el sistema y son una sola por reserva. El rol "durante" se coló en la
-- misma regla, y ése no lo genera nadie automáticamente: lo carga una persona,
-- y en una estadía de seis meses van varios cambios de blancos.
--
-- Se acota el índice a los dos roles que sí son únicos. La protección contra
-- duplicados de la importación queda intacta.
--
-- Que no se descontrole: un departamento sigue sin poder tener dos limpiezas
-- el mismo día. Eso lo controla la pantalla de alta manual, no este índice.
-- ============================================================================

drop index if exists limpiezas_unica_por_reserva_rol;

create unique index limpiezas_unica_por_reserva_rol
  on limpiezas (reserva_id, rol_reserva)
  where reserva_id is not null and rol_reserva in ('salida', 'entrada');
