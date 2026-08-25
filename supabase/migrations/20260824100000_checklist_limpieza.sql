-- Checklist de limpieza configurable y tareas periódicas (spec Fase 2,
-- docs/FASE-2-VISTA-LIMPIEZA.md §2.6 y la corrección del 24/08/2026).
--
-- `limpieza_checklist` ya existía (migración inicial) pero no tenía de dónde
-- salir: cada fila guardaba `item`/`seccion` como texto suelto, sin ningún
-- catálogo central que administración pudiera editar. Estas dos tablas son
-- ese catálogo.
--
-- Las tareas periódicas (vidrios, colchones, filtros) son un caso aparte: NO
-- se hacen en cada limpieza, sino cada tantos días. En vez de guardar "hace
-- cuántos días se hizo" como un contador que hay que mantener actualizado
-- (el mismo error del saldo acumulado de Ninox que nombra CLAUDE.md), se
-- calcula en el momento buscando la limpieza más reciente de ese depto donde
-- se marcó esa tarea como hecha. Por eso `limpieza_checklist` suma una
-- columna nullable que enlaza cada fila con su tarea periódica, cuando
-- corresponde.

create table checklist_catalogo (
  id uuid primary key default gen_random_uuid(),
  seccion text not null,
  item text not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table tareas_periodicas_catalogo (
  id uuid primary key default gen_random_uuid(),
  item text not null,
  frecuencia_dias integer not null,
  orden integer not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table limpieza_checklist
  add column tarea_periodica_id uuid references tareas_periodicas_catalogo (id);

-- Para "¿cuándo se hizo por última vez esta tarea en este depto?": filtra
-- rápido las filas de tareas periódicas hechas antes de llegar a limpiezas.
create index idx_checklist_tarea_periodica on limpieza_checklist (tarea_periodica_id)
  where tarea_periodica_id is not null and hecho;

alter table limpiezas
  add column observacion_proxima text;
comment on column limpiezas.observacion_proxima is
  'Lo que la persona que limpió deja anotado para quien limpie ese departamento la próxima vez. Distinto de notas, que es de uso interno/administración.';

-- ----------------------------------------------------------------------------
-- El checklist real, migrado de Ninox tal cual (spec §2.6).
-- ----------------------------------------------------------------------------

insert into checklist_catalogo (seccion, item, orden) values
  ('Cocina', 'Heladera vacía y limpia por dentro', 1),
  ('Cocina', 'Bacha y grifería sin manchas', 2),
  ('Cocina', 'Mesada desinfectada', 3),
  ('Cocina', 'Vajilla guardada y completa', 4),
  ('Cocina', 'Anafe u hornallas limpios', 5),
  ('Cocina', 'Horno limpio por dentro', 6),
  ('Cocina', 'Basura sacada, tacho con bolsa nueva', 7),
  ('Cocina', 'Repasadores limpios y doblados', 8),
  ('Cocina', 'Cafetera o pava sin sarro', 9),
  ('Cocina', 'Piso barrido y trapeado', 10),
  ('Funcionamiento', 'Wifi probado y funcionando', 11),
  ('Funcionamiento', 'Aire acondicionado probado (frío y calor)', 12),
  ('Funcionamiento', 'TV y control remoto funcionando', 13),
  ('Funcionamiento', 'Cerraduras y llaves probadas', 14),
  ('Funcionamiento', 'Luces de todos los ambientes probadas', 15),
  ('Funcionamiento', 'Agua caliente probada', 16),
  ('Funcionamiento', 'Extractor de baño o cocina funcionando', 17),
  ('Baño', 'Inodoro desinfectado', 18),
  ('Baño', 'Ducha o bañera sin sarro ni pelos', 19),
  ('Baño', 'Espejo sin manchas', 20),
  ('Baño', 'Toallas y amenities repuestos', 21),
  ('Baño', 'Piso y zócalos limpios', 22),
  ('Habitación', 'Cama tendida con blancos limpios', 23),
  ('Habitación', 'Placard vacío y ordenado', 24),
  ('Habitación', 'Cortinas o persianas funcionando', 25),
  ('Habitación', 'Superficies sin polvo', 26),
  ('Habitación', 'Piso aspirado o trapeado', 27);

insert into tareas_periodicas_catalogo (item, frecuencia_dias, orden) values
  ('Vidrios de las ventanas', 15, 1),
  ('Airear o dar vuelta los colchones', 30, 2),
  ('Filtros de aire acondicionado', 20, 3);

-- ----------------------------------------------------------------------------
-- Auditoría y RLS: mismo criterio que el resto del sistema.
-- ----------------------------------------------------------------------------

create trigger audit_checklist_catalogo
  after insert or update or delete on checklist_catalogo
  for each row execute function audit_trigger();
create trigger audit_tareas_periodicas_catalogo
  after insert or update or delete on tareas_periodicas_catalogo
  for each row execute function audit_trigger();

create trigger updated_at_checklist_catalogo before update on checklist_catalogo
  for each row execute function set_updated_at();
create trigger updated_at_tareas_periodicas_catalogo before update on tareas_periodicas_catalogo
  for each row execute function set_updated_at();

alter table checklist_catalogo enable row level security;
alter table tareas_periodicas_catalogo enable row level security;

-- Fase 1: solo autenticados, nada para anon (mismo criterio que el resto).
-- Quién puede EDITAR el catálogo se resuelve en la pantalla de
-- administración, no acá — mismo patrón que tarifas y parametros_operativos.
create policy autenticados_todo on checklist_catalogo
  for all to authenticated using (true) with check (true);
create policy autenticados_todo on tareas_periodicas_catalogo
  for all to authenticated using (true) with check (true);
