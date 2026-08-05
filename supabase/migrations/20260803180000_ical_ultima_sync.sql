-- ============================================================================
-- Sincronización por iCal (spec §2.12): se registra cuándo se leyó por
-- última vez el calendario de cada departamento, para saber si está al día.
-- ============================================================================

alter table departamentos add column ical_ultima_sync timestamptz;
