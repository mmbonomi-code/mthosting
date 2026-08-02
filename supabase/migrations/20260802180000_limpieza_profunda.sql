-- ============================================================================
-- Reglas de pago de las limpiezas (decisión del dueño, 02/08/2026):
--
--   - Pago DOBLE: limpieza inicial, limpieza profunda, domingos y feriados.
--   - Repaso: se paga el 50% del valor.
--
-- "Profunda" no existía como tipo: se agrega.
-- ============================================================================

alter type limpieza_tipo add value 'profunda' after 'inicial';
