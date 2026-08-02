-- ============================================================================
-- El acuerdo de pago es POR DEPARTAMENTO, no por propietario (decisión del
-- dueño, 02/08/2026). Lo confirma el export de Ninox: hay propietarios con
-- departamentos bajo acuerdos distintos.
--
-- Mismo criterio que ya se aplicó a la comisión.
-- ============================================================================

alter table propietarios drop column acuerdo_pago;
alter table departamentos add column acuerdo_pago acuerdo_pago;
