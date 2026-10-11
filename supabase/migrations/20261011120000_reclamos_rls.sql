-- ============================================================================
-- Los reclamos se podían leer SIN iniciar sesión (encontrado el 11/10/2026).
--
-- `20260811120000_reclamos.sql` rehízo la tabla con `drop table` + `create
-- table` y creó la política `reclamos_gestion`, pero nunca activó RLS sobre la
-- tabla nueva (sí sobre `reclamo_fotos`). Una política sin RLS activado no
-- hace nada: con la clave pública que viaja en el navegador se leían los 29
-- reclamos, con montos y motivos, sin usuario ni contraseña. Lo detectó el
-- asesor de seguridad de Supabase (`rls_disabled_in_public`).
--
-- Activarlo enciende la regla que ya estaba escrita: administración, manager
-- y coordinación (`puede_gestionar_reclamos()`). Son los mismos tres roles que
-- hoy usan reclamos en pantalla (Reclamos, panel de Alertas y la ficha del
-- Día, que ya pregunta el permiso antes de leer), así que nadie que trabaje
-- con reclamos se queda afuera.
-- ============================================================================

alter table reclamos enable row level security;

revoke all on reclamos from anon;
revoke all on reclamo_fotos from anon;
