-- ----------------------------------------------------------------------------
-- La sección económica pasa a ser SOLO de administración.
--
-- Decisión de Marcos, 16/08/2026. Antes la veían manager y administración
-- (13/08/2026); acá hay plata, saldos con propietarios y nombres y apellidos
-- de huéspedes, y se decidió cerrarla a un solo rol.
--
-- Se cambia la función y no las políticas: las ocho tablas del módulo la usan
-- por nombre, así que con esto quedan todas al día de una y no hay forma de
-- que una se olvide. Ese fue el motivo de centralizarla en su momento.
--
-- OJO: esta es la puerta de verdad. La comprobación de `lib/economico/permisos.ts`
-- sirve para mostrar un mensaje decente en vez de una pantalla vacía, pero un
-- manager que llamara a la API directamente pasaría igual si esto no cambiara.
-- ----------------------------------------------------------------------------

create or replace function puede_ver_economico()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
      from personas p
     where p.profile_id = auth.uid()
       and p.activo
       and p.rol = 'admin'
  );
$$;
