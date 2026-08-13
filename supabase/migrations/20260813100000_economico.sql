-- Sección ECONÓMICO — modelo de datos (spec docs/ECONOMICO-ESPECIFICACION.md).
--
-- El almacenamiento es un LIBRO DE MOVIMIENTOS genérico, no una tabla de
-- "cobros de Airbnb". La etapa 2 de la sección (giros a propietarios, gastos
-- por departamento, resultado por unidad) tiene que ser filas de otra
-- categoría en esta misma tabla, no un modelo nuevo.
--
-- Tres decisiones del dueño (13/08/2026) que se leen en todo el archivo:
--
-- 1. La GANANCIA de MTHosting se calcula SIEMPRE con la comisión ordinaria
--    del departamento. Cuando MTHosting cobra de más es devolución de gastos
--    que puso, no una comisión mayor: entra más plata pero no se gana más.
-- 2. Por eso NO se versiona la comisión. En su lugar, cada movimiento guarda
--    el % con el que se lo calculó (`comision_pct_aplicada`). La historia
--    queda congelada: corregir una comisión mal cargada no reescribe la
--    ganancia del año pasado. Recalcular hacia atrás es un botón explícito.
-- 3. La moneda de reporte es el dólar. Las filas Reserva y Cobro como
--    coanfitrión ya vienen en USD; solo algunos Payout vienen en otra moneda
--    y ahí el tipo de cambio se despeja del propio grupo, marcado como
--    deducido para que en pantalla se sepa que es un valor calculado.

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------

-- Qué es cada movimiento. Los primeros ocho son los `Tipo` del CSV de Airbnb;
-- `aircover` es un `Cobro de la resolución` que el detalle delata como
-- reembolso por daños, y `otro` recoge cualquier tipo que Airbnb agregue:
-- una fila desconocida se guarda y se muestra, nunca se descarta en silencio.
-- La etapa 2 agrega sus categorías acá (alter type ... add value).
create type economico_categoria as enum (
  'reserva',
  'coanfitrion',
  'payout',
  'resolucion',
  'ajuste',
  'ajuste_resolucion',
  'tarifa_cancelacion',
  'reembolso_tarifa_cancelacion',
  'aircover',
  'otro'
);

-- Cobros efectivos (histórico, se acumula) vs programados (futuro, se
-- reemplaza entero en cada carga).
create type economico_tipo_carga as enum ('efectivo', 'programado');

create type economico_estado_lote as enum ('vigente', 'deshecho');

-- Ninguna cuenta se clasifica sola: nace sin clasificar y la tilda una persona.
create type cuenta_clasificacion as enum ('mth', 'propietario', 'sin_clasificar');

-- Qué hacer con un AirCover: no se decide desde el CSV.
create type aircover_destino as enum ('sin_asignar', 'mthosting', 'propietario');

-- ----------------------------------------------------------------------------
-- Lotes de importación
-- ----------------------------------------------------------------------------

-- Los ~40 CSV de una sentada son UN lote, para poder deshacer la carga
-- completa de un click.
create table importaciones_economico (
  id uuid primary key default gen_random_uuid(),
  tipo economico_tipo_carga not null,
  estado economico_estado_lote not null default 'vigente',
  usuario_id uuid references auth.users (id),
  archivos integer not null default 0,
  filas_leidas integer not null default 0,
  filas_nuevas integer not null default 0,
  filas_duplicadas integer not null default 0,
  filas_sin_mapear integer not null default 0,
  -- Cuentas de payout nuevas que aparecieron en este lote y hay que clasificar.
  cuentas_nuevas integer not null default 0,
  -- Lo que no cerró: payouts huérfanos, tipos desconocidos, archivos rotos.
  avisos jsonb not null default '[]',
  cerrado_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un renglón por archivo del lote: si uno falla los demás siguen, y el
-- resumen final tiene que poder decir cuál falló y por qué.
create table archivos_economico (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references importaciones_economico (id),
  nombre text not null,
  -- sha256 del contenido: detecta que se subió dos veces el mismo archivo.
  hash text not null,
  filas_leidas integer not null default 0,
  filas_nuevas integer not null default 0,
  filas_duplicadas integer not null default 0,
  filas_sin_mapear integer not null default 0,
  error text,
  created_at timestamptz not null default now()
);

create index idx_archivos_economico_import on archivos_economico (import_id);
create index idx_archivos_economico_hash on archivos_economico (hash);

-- ----------------------------------------------------------------------------
-- Cuentas de destino de los payouts
-- ----------------------------------------------------------------------------

-- El destino viene en `Detalles`, texto libre, y el MISMO destino aparece con
-- muchas grafías: la cuenta 4343 figura como MTHOSTING, MTHosting LLC,
-- MT HOSTING, MT Hosting, Checking y Savings. Una fila por cuenta real, no
-- por grafía: por eso la clave es el número cuando se puede extraer.
--
-- El 4343 NO es una regla de negocio ni se escribe en el código: es solo un
-- valor de precarga. Hay más cuentas de MTHosting y la única fuente de verdad
-- es la clasificación que se tilda acá.
create table cuentas_payout (
  id uuid primary key default gen_random_uuid(),
  -- 'num:4343' cuando hay número, 'txt:<detalle normalizado>' cuando no.
  clave text not null unique,
  titular text,
  numero text,
  -- checking / savings / paypal / payoneer / iban / otro
  tipo text,
  moneda text,
  clasificacion cuenta_clasificacion not null default 'sin_clasificar',
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Cada grafía encontrada, para poder mostrar de dónde salió cada cuenta.
create table cuentas_payout_alias (
  id uuid primary key default gen_random_uuid(),
  cuenta_id uuid not null references cuentas_payout (id),
  detalle_raw text not null unique,
  created_at timestamptz not null default now()
);

create index idx_cuentas_payout_alias_cuenta on cuentas_payout_alias (cuenta_id);
create index idx_cuentas_payout_clasificacion on cuentas_payout (clasificacion);

-- ----------------------------------------------------------------------------
-- El libro de movimientos
-- ----------------------------------------------------------------------------

create table movimientos_economicos (
  id uuid primary key default gen_random_uuid(),

  -- De dónde salió. Sin esto no se puede auditar un número (spec §6.6).
  import_id uuid not null references importaciones_economico (id),
  archivo text not null,
  -- Número de renglón en el CSV, contando el encabezado. Es lo que se abre
  -- en Excel para mirar la fila con los ojos.
  linea integer not null,
  -- El orden dentro del archivo ES significativo: un Payout se compone de las
  -- filas que le siguen hasta el próximo Payout.
  orden_en_archivo integer not null,

  categoria economico_categoria not null,
  -- El `Tipo` tal cual vino, aunque no lo conozcamos.
  tipo_raw text not null,

  -- Fechas. Todas de negocio, `date`, nunca timestamptz (CLAUDE.md regla 1).
  fecha date not null, -- columna Fecha: cuándo entró la plata
  fecha_reserva date,
  fecha_inicio date,
  fecha_fin date,
  noches integer,

  -- A quién se imputa. depto_id null = el anuncio todavía no está mapeado;
  -- la fila NO se descarta, queda en la bandeja.
  depto_id uuid references departamentos (id),
  anuncio text,
  -- El propietario sale del departamento. La columna existe para la etapa 2:
  -- un giro a un propietario es un movimiento sin departamento.
  propietario_id uuid references propietarios (id),

  codigo_confirmacion text,
  huesped text,
  detalles text,

  -- Plata. Siempre monto + moneda (CLAUDE.md regla 2).
  moneda text not null,
  -- OJO: acá el signo SÍ va en el monto, al revés que en la caja. Las líneas
  -- de coanfitrión son negativas y a veces positivas (devoluciones de
  -- comisión al ajustar una reserva). Guardar el valor absoluto rompe el
  -- cálculo: una devolución sumaría en vez de restar.
  monto numeric,
  -- En las filas Payout `Monto` viene vacío y el importe está en `Cobrado`.
  cobrado numeric,
  -- El importe que corresponde a esta fila: `cobrado` en los payouts, `monto`
  -- en el resto. Se guarda resuelto para no repetir el coalesce en cada query.
  importe numeric,
  tarifa_limpieza numeric,
  ingresos_brutos numeric,

  -- Agrupamiento payout → detalle, dentro del archivo.
  grupo_payout integer,
  es_payout boolean not null default false,
  cuenta_id uuid references cuentas_payout (id),
  -- Hecho inmutable leído del archivo: si el grupo trae línea de coanfitrión,
  -- la comisión ya se cobró por ese canal. Se guarda separado de `es_custodia`
  -- porque eso además depende de cómo esté clasificada la cuenta, y esa
  -- clasificación se puede cambiar después sin reimportar nada.
  grupo_con_coanfitrion boolean not null default false,

  -- Qué se hace con un reembolso de AirCover. Sin asignar no suma a ningún
  -- lado: comisionarlo solo equivale a cobrarle comisión al propietario sobre
  -- una indemnización por daños que suele corresponderle entera.
  aircover_destino aircover_destino not null default 'sin_asignar',

  -- ---- Resultado del motor de cálculo (etapa 2). Nulo hasta que corre. ----
  -- El % con el que se calculó, congelado (decisión del dueño 13/08/2026).
  comision_pct_aplicada numeric,
  ganancia_usd numeric,
  percibido_usd numeric,
  tc_usd numeric,
  -- true cuando el tipo de cambio se despejó del grupo en vez de venir dado.
  -- La pantalla tiene que aclarar que es un valor deducido.
  tc_deducido boolean not null default false,
  -- Payout a cuenta MTH que en realidad es plata del propietario. Se guarda
  -- aunque todavía no se muestre: es el insumo de los giros de la etapa 2.
  es_custodia boolean,
  -- Estadía de más de 30 noches, cobrada mes a mes y prorrateada.
  prorrateada boolean not null default false,
  calculado_en timestamptz,

  -- Deduplicación. hash(Tipo, Código, Fecha, Monto, Cobrado, Moneda, Anuncio,
  -- Detalles, ocurrencia). `Cobrado` es imprescindible: sin él, dos payouts
  -- distintos del mismo día a la misma cuenta colapsan en uno.
  huella text not null,
  -- Contador 1,2,3… de filas idénticas dentro del mismo archivo. Al reimportar
  -- el archivo vuelven a matchear una a una.
  ocurrencia integer not null default 1,

  raw jsonb not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedup solo entre las filas vivas: deshacer un lote las desactiva, y el
-- archivo se tiene que poder volver a importar. El índice es parcial a
-- propósito y por eso el importador NUNCA usa `on conflict`: compara contra
-- lo guardado y arma el insert con lo que falta.
create unique index idx_movimientos_economicos_huella
  on movimientos_economicos (huella) where activo;

create index idx_movimientos_economicos_depto_fecha
  on movimientos_economicos (depto_id, fecha) where activo;
create index idx_movimientos_economicos_fecha
  on movimientos_economicos (fecha) where activo;
create index idx_movimientos_economicos_import
  on movimientos_economicos (import_id);
create index idx_movimientos_economicos_codigo
  on movimientos_economicos (codigo_confirmacion);
create index idx_movimientos_economicos_cuenta
  on movimientos_economicos (cuenta_id) where activo;
-- La bandeja de anuncios sin mapear: la consulta que se hace después de cada
-- importación.
create index idx_movimientos_economicos_sin_mapear
  on movimientos_economicos (anuncio)
  where activo and depto_id is null;
-- Los AirCover pendientes de decisión, que son pocos y hay que encontrarlos.
create index idx_movimientos_economicos_aircover
  on movimientos_economicos (aircover_destino)
  where activo and categoria = 'aircover';

-- ----------------------------------------------------------------------------
-- Programados
-- ----------------------------------------------------------------------------

-- Tabla aparte, nunca mezclada con los efectivos: los pendientes mutan (pasan
-- a efectivos o se caen) y cada carga es un snapshot completo que reemplaza al
-- anterior. El anterior no se borra: queda como no vigente para poder auditar
-- qué se cayó.
create table cobros_programados (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references importaciones_economico (id),
  archivo text not null,
  linea integer not null,
  orden_en_archivo integer not null,

  vigente boolean not null default true,
  -- Ya apareció en los efectivos: se excluye del proyectado para no contar
  -- dos veces la misma plata.
  materializado boolean not null default false,

  categoria economico_categoria not null,
  tipo_raw text not null,
  fecha date not null,
  fecha_reserva date,
  fecha_inicio date,
  fecha_fin date,
  noches integer,

  depto_id uuid references departamentos (id),
  anuncio text,
  codigo_confirmacion text,
  huesped text,
  detalles text,

  moneda text not null,
  monto numeric,
  importe numeric,
  tarifa_limpieza numeric,
  ingresos_brutos numeric,

  huella text not null,
  ocurrencia integer not null default 1,

  raw jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_cobros_programados_vigentes
  on cobros_programados (depto_id, fecha) where vigente;
create index idx_cobros_programados_import on cobros_programados (import_id);
create index idx_cobros_programados_codigo on cobros_programados (codigo_confirmacion);
-- Dentro de un snapshot la huella es única; entre snapshots se repite a
-- propósito, que es lo que permite calcular el diff.
create unique index idx_cobros_programados_huella
  on cobros_programados (import_id, huella);

-- ----------------------------------------------------------------------------
-- Auditoría y updated_at
-- ----------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'importaciones_economico', 'cuentas_payout', 'cuentas_payout_alias',
    'movimientos_economicos', 'cobros_programados'
  ]
  loop
    execute format(
      'create trigger audit_%1$s after insert or update or delete on %1$I
         for each row execute function audit_trigger()', t);
  end loop;

  foreach t in array array[
    'importaciones_economico', 'cuentas_payout', 'movimientos_economicos',
    'cobros_programados'
  ]
  loop
    execute format(
      'create trigger updated_at_%1$s before update on %1$I
         for each row execute function set_updated_at()', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Permisos: manager y administración, cerrado también en la base.
--
-- Acá hay plata y hay nombres y apellidos de huéspedes. Es la misma regla que
-- la caja, pero con función propia: son dos permisos distintos que hoy dan
-- igual, y mañana uno puede abrirse sin arrastrar al otro.
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
       and p.rol in ('admin', 'manager')
  );
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'importaciones_economico', 'archivos_economico', 'cuentas_payout',
    'cuentas_payout_alias', 'movimientos_economicos', 'cobros_programados'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %1$s_solo_manager on %1$I
         for all to authenticated
         using (puede_ver_economico()) with check (puede_ver_economico())', t);
  end loop;
end;
$$;

-- ----------------------------------------------------------------------------
-- Precarga y correcciones de datos (decisiones del dueño, 13/08/2026)
-- ----------------------------------------------------------------------------

-- Payoneer es de PROPIETARIOS: MTHosting lo usó años atrás, pero hoy esos
-- payouts no son ingreso propio. Se precarga para que no aparezca como
-- pendiente de clasificar en la primera importación.
insert into cuentas_payout (clave, titular, tipo, moneda, clasificacion, notas)
values (
  'txt:transferir a tarjeta de debito: payoneer (usd)',
  'Tarjeta de débito: Payoneer',
  'payoneer',
  'USD',
  'propietario',
  'Precargada: los destinos Payoneer son de propietarios (decisión del dueño).'
);

-- El único departamento sin comisión cargada. Va al 20%, que es el valor de
-- los otros 120. (CABELLO 2 está al 10% a propósito y no se toca.)
update departamentos set comision_pct = 20
 where comision_pct is null;

-- El anuncio que quedó sin departamento en el relevamiento manual.
insert into listing_alias (canal, nombre_listing, depto_id)
select 'airbnb', 'Gran Departamento para 12 personas en Buenos Aires', id
  from departamentos where codigo = 'CORRIENTES 1'
on conflict (canal, nombre_listing) do nothing;

-- JUNCAL 1 y JUNCAL 2 son la misma unidad. Tres anuncios apuntaban a dos
-- departamentos distintos, así que la plata de una sola unidad se partía en
-- dos. Se unifican en JUNCAL 2, que es el que está activo.
--
-- Esto reapunta el ANUNCIO. Los dos departamentos siguen existiendo por
-- separado: fusionar las fichas arrastra reservas y limpiezas ya cargadas y
-- es una decisión aparte.
update listing_alias
   set depto_id = (select id from departamentos where codigo = 'JUNCAL 2')
 where canal = 'airbnb'
   and nombre_listing = 'Tranquilo y comodo en recoleta';
