-- Módulo Reporte: lo que el back office se deja asentado entre sí.
--
-- Reemplaza los cuadros de texto libre del sistema viejo. El problema de un
-- cuadro de texto no es que falte espacio: es que nada vence, nada se puede
-- marcar hecho sin borrar el renglón, dos personas que editan a la vez se
-- pisan, y no queda registro de quién escribió qué.
--
-- Cada renglón pasa a ser una fila con fecha, responsable y estado.
--
-- La tabla `reportes` de la migración inicial (persona_id, fecha, contenido)
-- no sirve para esto y estaba VACÍA (0 filas, verificado antes de escribir
-- esto), así que se rehace.

create type reporte_seccion as enum ('anuncio', 'pendiente');

create type reporte_estado as enum ('pendiente', 'hecho');

create type equipamiento_tipo as enum ('cuna', 'silla', 'banadera');

create type equipamiento_estado as enum ('pedido', 'entregado', 'retirado');

drop table reportes;

create table notas_reporte (
  id uuid primary key default gen_random_uuid(),
  seccion reporte_seccion not null,
  titulo text not null,
  detalle text,
  -- Un pendiente tiene un día. Un anuncio puede tener un tramo: "pintan el
  -- 28 y 29". Con `fecha_hasta` nula, el anuncio vale desde `fecha` en
  -- adelante hasta que alguien lo marque hecho.
  fecha date,
  fecha_hasta date,
  depto_id uuid references departamentos (id),
  -- Pendientes, Logística y Diego eran la misma lista con distinto dueño
  -- (decisión del dueño, 11/08/2026). Se guarda a quién le toca y las
  -- secciones de antes se arman solas con eso; si mañana entra o sale
  -- alguien, se agrega una persona y listo.
  responsable_id uuid references personas (id),
  estado reporte_estado not null default 'pendiente',
  hecho_at timestamptz,
  hecho_por uuid references auth.users (id),
  creado_por uuid references auth.users (id) default auth.uid(),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_hasta is null or fecha is null or fecha_hasta >= fecha)
);

create index idx_notas_reporte_seccion on notas_reporte (seccion, estado);
create index idx_notas_reporte_fecha on notas_reporte (fecha);
create index idx_notas_reporte_depto on notas_reporte (depto_id);

-- Cunas, sillas de comer y bañaderas de bebé. Se puede colgar de una reserva
-- —y entonces el departamento y las fechas salen de ahí— o cargarse suelta
-- con departamento y fechas a mano, para lo que no corresponde a ninguna
-- reserva puntual.
create table equipamiento_bebe (
  id uuid primary key default gen_random_uuid(),
  tipo equipamiento_tipo not null,
  reserva_id uuid references reservas (id),
  depto_id uuid references departamentos (id),
  fecha_desde date not null,
  fecha_hasta date not null,
  estado equipamiento_estado not null default 'pedido',
  notas text,
  creado_por uuid references auth.users (id) default auth.uid(),
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_hasta >= fecha_desde),
  -- Tiene que estar colgado de algo: de una reserva o de un departamento.
  check (reserva_id is not null or depto_id is not null)
);

create index idx_equipamiento_fechas on equipamiento_bebe (fecha_desde, fecha_hasta);
create index idx_equipamiento_reserva on equipamiento_bebe (reserva_id);
create index idx_equipamiento_depto on equipamiento_bebe (depto_id);

create trigger audit_notas_reporte after insert or update or delete on notas_reporte
  for each row execute function audit_trigger();
create trigger audit_equipamiento_bebe after insert or update or delete on equipamiento_bebe
  for each row execute function audit_trigger();

create trigger updated_at_notas_reporte before update on notas_reporte
  for each row execute function set_updated_at();
create trigger updated_at_equipamiento_bebe before update on equipamiento_bebe
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Permisos: lo escribe el back office; lo lee cualquiera que use el sistema.
--
-- Un aviso como "Arenales 5: pintan el 28 y 29" o una cuna pedida para el
-- jueves le sirve a quien coordina ese día, no solo a quien lo escribió, y
-- acá no hay montos. Por eso la lectura es abierta y la escritura no.
-- ----------------------------------------------------------------------------

create or replace function puede_escribir_reporte()
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
       and (p.rol in ('admin', 'manager') or p.es_backoffice)
  );
$$;

alter table notas_reporte enable row level security;
alter table equipamiento_bebe enable row level security;

create policy notas_reporte_lectura on notas_reporte
  for select to authenticated using (true);

create policy notas_reporte_escritura on notas_reporte
  for all to authenticated
  using (puede_escribir_reporte())
  with check (puede_escribir_reporte());

create policy equipamiento_lectura on equipamiento_bebe
  for select to authenticated using (true);

create policy equipamiento_escritura on equipamiento_bebe
  for all to authenticated
  using (puede_escribir_reporte())
  with check (puede_escribir_reporte());
