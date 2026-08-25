-- Endurece RLS para el rol `limpieza` (CLAUDE.md, "antes de que entre el
-- personal de limpieza"), en las tablas que toca "Mis limpiezas". Todo lo
-- demás sigue exactamente igual que hoy: cada política nueva dice "si no sos
-- limpieza, seguís como estabas" antes de aplicar la condición angosta.
--
-- La gobernanta es un rol híbrido (spec §2.10.bis / §3.11): también hace
-- limpiezas y se le pueden asignar, pero además reparte el trabajo de
-- otras personas. Por eso NO se restringe como `limpieza` — necesita ver
-- todos los departamentos y todas las limpiezas para poder distribuir. Las
-- condiciones de abajo son literalmente "rol = limpieza", nunca "tiene algo
-- asignado", así que gobernanta queda afuera de la restricción a propósito.
--
-- Límite conocido: RLS filtra FILAS, no columnas. Con acceso a su propio
-- departamento, `limpieza` técnicamente sigue pudiendo leer
-- `airbnb_user`/`airbnb_pass` de ESE departamento (antes los veía de
-- CUALQUIER departamento) y el contacto del huésped de ESA reserva. Sacar
-- esas columnas del todo requiere una tabla aparte — queda para otra sesión.

create or replace function mi_persona_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from personas where profile_id = auth.uid() and activo limit 1;
$$;

create or replace function mi_rol()
returns rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from personas where profile_id = auth.uid() and activo limit 1;
$$;

/** Los departamentos donde esta persona tiene (o tuvo) alguna limpieza asignada. */
create or replace function mis_deptos()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct depto_id from limpiezas where asignado_a = mi_persona_id();
$$;

-- ----------------------------------------------------------------------------
-- personas: limpieza solo ve su propia ficha.
-- ----------------------------------------------------------------------------

drop policy if exists autenticados_todo on personas;
create policy personas_acceso on personas
  for all to authenticated
  using (mi_rol() <> 'limpieza' or profile_id = auth.uid())
  with check (mi_rol() <> 'limpieza' or profile_id = auth.uid());

-- ----------------------------------------------------------------------------
-- departamentos y banos_depto: limpieza ve solo lo que le toca. Nunca
-- escribe: no tiene pantalla que edite la ficha del departamento.
-- ----------------------------------------------------------------------------

drop policy if exists autenticados_todo on departamentos;
create policy departamentos_lectura on departamentos
  for select to authenticated
  using (mi_rol() <> 'limpieza' or id in (select mis_deptos()));
create policy departamentos_escritura on departamentos
  for insert to authenticated with check (mi_rol() <> 'limpieza');
create policy departamentos_actualizacion on departamentos
  for update to authenticated
  using (mi_rol() <> 'limpieza') with check (mi_rol() <> 'limpieza');
create policy departamentos_baja on departamentos
  for delete to authenticated using (mi_rol() <> 'limpieza');

drop policy if exists autenticados_todo on banos_depto;
create policy banos_depto_lectura on banos_depto
  for select to authenticated
  using (mi_rol() <> 'limpieza' or depto_id in (select mis_deptos()));
create policy banos_depto_escritura on banos_depto
  for all to authenticated
  using (mi_rol() <> 'limpieza')
  with check (mi_rol() <> 'limpieza');

-- ----------------------------------------------------------------------------
-- reservas y eventos_estadia: limpieza ve las de los departamentos que le
-- tocan (necesita noches, fechas y horas coordinadas), nunca escribe.
-- ----------------------------------------------------------------------------

drop policy if exists autenticados_todo on reservas;
create policy reservas_lectura on reservas
  for select to authenticated
  using (mi_rol() <> 'limpieza' or depto_id in (select mis_deptos()));
create policy reservas_escritura on reservas
  for insert to authenticated with check (mi_rol() <> 'limpieza');
create policy reservas_actualizacion on reservas
  for update to authenticated
  using (mi_rol() <> 'limpieza') with check (mi_rol() <> 'limpieza');
create policy reservas_baja on reservas
  for delete to authenticated using (mi_rol() <> 'limpieza');

drop policy if exists autenticados_todo on eventos_estadia;
create policy eventos_estadia_lectura on eventos_estadia
  for select to authenticated
  using (
    mi_rol() <> 'limpieza'
    or reserva_id in (select id from reservas where depto_id in (select mis_deptos()))
  );
create policy eventos_estadia_escritura on eventos_estadia
  for all to authenticated
  using (mi_rol() <> 'limpieza')
  with check (mi_rol() <> 'limpieza');

-- ----------------------------------------------------------------------------
-- limpiezas: limpieza ve y actualiza (estado, fotos, checklist, viático)
-- solo las que tiene asignadas. Nunca las crea ni las borra: eso lo decide
-- el importador o una persona con más permiso.
-- ----------------------------------------------------------------------------

drop policy if exists autenticados_todo on limpiezas;
create policy limpiezas_lectura on limpiezas
  for select to authenticated
  using (mi_rol() <> 'limpieza' or asignado_a = mi_persona_id());
create policy limpiezas_actualizacion on limpiezas
  for update to authenticated
  using (mi_rol() <> 'limpieza' or asignado_a = mi_persona_id())
  with check (mi_rol() <> 'limpieza' or asignado_a = mi_persona_id());
create policy limpiezas_escritura on limpiezas
  for insert to authenticated with check (mi_rol() <> 'limpieza');
create policy limpiezas_baja on limpiezas
  for delete to authenticated using (mi_rol() <> 'limpieza');

-- ----------------------------------------------------------------------------
-- El checklist de cada limpieza: se lee y se marca solo el propio.
-- ----------------------------------------------------------------------------

drop policy if exists autenticados_todo on limpieza_checklist;
create policy limpieza_checklist_acceso on limpieza_checklist
  for all to authenticated
  using (
    mi_rol() <> 'limpieza'
    or limpieza_id in (select id from limpiezas where asignado_a = mi_persona_id())
  )
  with check (
    mi_rol() <> 'limpieza'
    or limpieza_id in (select id from limpiezas where asignado_a = mi_persona_id())
  );

-- ----------------------------------------------------------------------------
-- Fotos y arreglos: se suman contra la propia limpieza. No se editan ni se
-- borran desde esta pantalla (baja lógica de arreglos la hace otro rol).
-- ----------------------------------------------------------------------------

drop policy if exists autenticados_todo on limpieza_fotos;
create policy limpieza_fotos_lectura on limpieza_fotos
  for select to authenticated
  using (
    mi_rol() <> 'limpieza'
    or limpieza_id in (select id from limpiezas where asignado_a = mi_persona_id())
  );
create policy limpieza_fotos_alta on limpieza_fotos
  for insert to authenticated
  with check (
    mi_rol() <> 'limpieza'
    or limpieza_id in (select id from limpiezas where asignado_a = mi_persona_id())
  );
create policy limpieza_fotos_sin_edicion on limpieza_fotos
  for update to authenticated
  using (mi_rol() <> 'limpieza') with check (mi_rol() <> 'limpieza');
create policy limpieza_fotos_sin_baja on limpieza_fotos
  for delete to authenticated using (mi_rol() <> 'limpieza');

drop policy if exists autenticados_todo on arreglos;
create policy arreglos_lectura on arreglos
  for select to authenticated
  using (
    mi_rol() <> 'limpieza'
    or limpieza_id in (select id from limpiezas where asignado_a = mi_persona_id())
  );
create policy arreglos_alta on arreglos
  for insert to authenticated
  with check (
    mi_rol() <> 'limpieza'
    or limpieza_id in (select id from limpiezas where asignado_a = mi_persona_id())
  );
create policy arreglos_sin_edicion on arreglos
  for update to authenticated
  using (mi_rol() <> 'limpieza') with check (mi_rol() <> 'limpieza');
create policy arreglos_sin_baja on arreglos
  for delete to authenticated using (mi_rol() <> 'limpieza');

-- ----------------------------------------------------------------------------
-- Los dos catálogos: cualquier autenticado los lee (no son datos sensibles),
-- pero solo administración los edita. Esto endurece algo más amplio que
-- limpieza: hoy CUALQUIER rol podía escribirlos por API aunque la pantalla
-- de /checklist-limpieza ya lo restringía a manager/admin.
-- ----------------------------------------------------------------------------

create or replace function puede_editar_checklist()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from personas p
     where p.profile_id = auth.uid() and p.activo and p.rol in ('admin', 'manager')
  );
$$;

drop policy if exists autenticados_todo on checklist_catalogo;
create policy checklist_catalogo_lectura on checklist_catalogo
  for select to authenticated using (true);
create policy checklist_catalogo_escritura on checklist_catalogo
  for insert to authenticated with check (puede_editar_checklist());
create policy checklist_catalogo_actualizacion on checklist_catalogo
  for update to authenticated using (puede_editar_checklist()) with check (puede_editar_checklist());
create policy checklist_catalogo_baja on checklist_catalogo
  for delete to authenticated using (puede_editar_checklist());

drop policy if exists autenticados_todo on tareas_periodicas_catalogo;
create policy tareas_periodicas_lectura on tareas_periodicas_catalogo
  for select to authenticated using (true);
create policy tareas_periodicas_escritura on tareas_periodicas_catalogo
  for insert to authenticated with check (puede_editar_checklist());
create policy tareas_periodicas_actualizacion on tareas_periodicas_catalogo
  for update to authenticated using (puede_editar_checklist()) with check (puede_editar_checklist());
create policy tareas_periodicas_baja on tareas_periodicas_catalogo
  for delete to authenticated using (puede_editar_checklist());

-- ----------------------------------------------------------------------------
-- Storage: las fotos y comprobantes de una limpieza, solo de las propias.
-- La ruta siempre empieza con el id de la limpieza (ver acciones.ts), así
-- que alcanza con mirar el primer tramo del path.
-- ----------------------------------------------------------------------------

drop policy if exists limpiezas_storage_autenticados on storage.objects;
create policy limpiezas_storage_acceso on storage.objects
  for all to authenticated
  using (
    bucket_id = 'limpiezas'
    and (
      mi_rol() <> 'limpieza'
      or (storage.foldername(name))[1] in (
        select id::text from limpiezas where asignado_a = mi_persona_id()
      )
    )
  )
  with check (
    bucket_id = 'limpiezas'
    and (
      mi_rol() <> 'limpieza'
      or (storage.foldername(name))[1] in (
        select id::text from limpiezas where asignado_a = mi_persona_id()
      )
    )
  );
