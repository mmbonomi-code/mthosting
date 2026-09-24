-- ============================================================================
-- Lo que el personal de limpieza no tiene que poder leer ni tocar por la API
-- (revisión de seguridad, 23/09/2026; decisión del dueño: cerrar solo a
-- limpieza, el resto de los roles queda como estaba).
--
-- El guardián de pantallas (proxy.ts) solo recorta el menú. Con su sesión,
-- cualquiera puede consultar la base directo, así que lo que protege de
-- verdad es esto.
--
-- `mi_rol()` es null para quien no tiene ficha o la tiene desactivada: con
-- `mi_rol() is not null` una persona dada de baja tampoco ve nada. El primer
-- admin se crea con la clave de servidor, que no pasa por RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Auditoría: el diff de `departamentos` trae las credenciales de Airbnb,
--    la comisión y el teléfono del propietario. Ninguna pantalla de limpieza
--    la usa. Escribe solo el trigger (security definer), no cambia.
-- ----------------------------------------------------------------------------

drop policy if exists autenticados_leen_audit on audit_log;
create policy audit_log_oficina on audit_log
  for select to authenticated
  using (mi_rol() is not null and mi_rol() <> 'limpieza');

-- ----------------------------------------------------------------------------
-- 2. Las tablas que seguían con la política de Fase 1 (`autenticados_todo`).
--    Ninguna pantalla de limpieza las lee, salvo el catálogo de ítems, que
--    arma el inventario de la ficha del departamento (solo lectura).
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'arreglo_fotos', 'bloqueos', 'distribucion_depto', 'feriados',
    'importaciones', 'item_catalogo', 'limpieza_faltantes',
    'liquidacion_lineas', 'liquidaciones', 'movimientos_acceso',
    'pagos_personal', 'parametros_operativos', 'prestadores', 'propietarios',
    'puntajes_calidad', 'puntos_acceso', 'tarifas'
  ]
  loop
    execute format('drop policy if exists autenticados_todo on %I', t);
    execute format(
      'create policy %1$s_oficina on %1$I
         for all to authenticated
         using (mi_rol() is not null and mi_rol() <> ''limpieza'')
         with check (mi_rol() is not null and mi_rol() <> ''limpieza'')', t);
  end loop;
end;
$$;

create policy item_catalogo_lectura on item_catalogo
  for select to authenticated
  using (mi_rol() is not null);

-- ----------------------------------------------------------------------------
-- 3. La ficha sin lo comercial corre con los permisos de su dueño, así que no
--    la frena RLS: se corta acá para quien no tiene rol (baja o sin ficha).
-- ----------------------------------------------------------------------------

create or replace view departamentos_ficha
with (security_barrier = true) as
select
  id,
  codigo,
  nombre_interno,
  estado,
  activo,
  direccion,
  barrio,
  ambientes,
  habitaciones,
  capacidad,
  camas_king,
  camas_queen,
  camas_twin,
  sillon_cama,
  total_camas,
  wifi_ssid,
  wifi_pass,
  wifi_velocidad,
  url_mapa,
  encargado_nombre,
  encargado_telefono,
  self_checkout,
  requiere_registro,
  requiere_aviso_seguridad,
  indicaciones_acceso,
  observacion
from departamentos
where mi_rol() is not null;
