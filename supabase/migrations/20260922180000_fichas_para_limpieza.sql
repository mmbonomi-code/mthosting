-- El personal de limpieza consulta la ficha de TODOS los departamentos, pero
-- sin lo comercial (decisión del dueño, 22/09/2026).
--
-- La tabla `departamentos` sigue cerrada para `limpieza` a los que tuvo
-- asignados (20260825100000_rls_limpieza.sql). Abrirla entera le daría, por
-- la API, las credenciales de Airbnb, el teléfono del propietario y la
-- comisión de los 121 departamentos: RLS filtra filas, no columnas. En vez de
-- eso, esta vista expone solo las columnas que la ficha le muestra.
--
-- Afuera, a propósito: propietario_id, propietario_telefono, airbnb_user,
-- airbnb_pass, url_publicacion, ical_url, comision_pct, acuerdo_pago.
-- Adentro: el encargado del edificio y el mapa, que sirven para llegar.

create view departamentos_ficha
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
from departamentos;

-- La vista corre con los permisos de su dueño (no con los de quien consulta),
-- así que no la frena el RLS de `departamentos`: por eso solo lleva columnas
-- que cualquier autenticado puede ver. Nada para `anon`.
revoke all on departamentos_ficha from anon, public;
grant select on departamentos_ficha to authenticated;

-- Los baños son parte de esa misma ficha y no tienen nada comercial.
drop policy if exists banos_depto_lectura on banos_depto;
create policy banos_depto_lectura on banos_depto
  for select to authenticated using (true);

-- ----------------------------------------------------------------------------
-- Anuncios vinculados e inventario: limpieza los lee, nunca los escribe.
-- Hasta ahora seguían con `autenticados_todo` y la ficha le ofrecía los
-- botones de agregar y desactivar anuncios a cualquiera que la abriera.
-- ----------------------------------------------------------------------------

drop policy if exists autenticados_todo on listing_alias;
create policy listing_alias_lectura on listing_alias
  for select to authenticated using (true);
create policy listing_alias_escritura on listing_alias
  for all to authenticated
  using (mi_rol() <> 'limpieza')
  with check (mi_rol() <> 'limpieza');

drop policy if exists autenticados_todo on inventario_depto;
create policy inventario_depto_lectura on inventario_depto
  for select to authenticated using (true);
create policy inventario_depto_escritura on inventario_depto
  for all to authenticated
  using (mi_rol() <> 'limpieza')
  with check (mi_rol() <> 'limpieza');
