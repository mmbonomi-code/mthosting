-- ============================================================================
-- Ajustes al modelo pedidos por el dueño (01/08/2026), Paso 2:
--
-- 1. propietarios.fecha_nacimiento (date).
-- 2. La comisión es POR DEPARTAMENTO, no por propietario: se mueve
--    comision_pct de propietarios a departamentos.
-- 3. Distribución del departamento (camas por ambiente): se remodela
--    distribucion_depto, que había quedado como borrador depto↔persona.
--    Además departamentos.banos (lo necesita "qué llevar" de Fase 2:
--    un pie de baño por baño).
-- 4. Credenciales de Airbnb sin cifrar, por decisión del dueño
--    (visibles solo para rol admin cuando se endurezca RLS en Fase 2).
--    No requiere cambio de esquema; queda registrado acá y en CLAUDE.md.
-- ============================================================================

alter table propietarios add column fecha_nacimiento date;

-- Comisión: de propietario a departamento. Sin datos que migrar (la columna
-- nunca se usó en producción).
alter table propietarios drop column comision_pct;
alter table departamentos add column comision_pct numeric;

alter table departamentos add column banos integer;

-- Distribución: qué camas hay en cada ambiente del departamento.
create type tipo_cama as enum ('king', 'queen', 'twin', 'sillon_cama', 'otra');

alter table distribucion_depto drop column persona_id;
alter table distribucion_depto add column ambiente text;
alter table distribucion_depto add column tipo_cama tipo_cama;
alter table distribucion_depto add column cantidad integer not null default 1;

-- El catálogo de ítems de inventario no admite nombres repetidos.
alter table item_catalogo add constraint item_catalogo_nombre_unico unique (nombre);
