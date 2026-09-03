-- Poder dar por revisada una alerta que nace de las fotos que saca la
-- limpieza (decisión del dueño, 02/09/2026).
--
-- Hasta ahora, de las cuatro categorías de foto que carga el personal de
-- limpieza, ninguna avisaba a nadie: quedaban en la ficha de la limpieza y
-- había que entrar a mirarlas. Las dos que importan de verdad —"dejó mal el
-- huésped" (que puede terminar en un reclamo a Airbnb, con 14 días de plazo)
-- y "se lo olvidó" (el huésped ya se fue y quiere su cargador)— ahora
-- encienden una alerta.
--
-- Toda alerta que se enciende sola necesita poder apagarse, o termina siendo
-- ruido permanente que se ignora. Pero apagarla con un booleano la apagaría
-- PARA SIEMPRE: si mañana la misma limpieza suma otra foto de olvido, nadie
-- se enteraría. Por eso se guarda la FIRMA de lo que se revisó (cuántas
-- fotos había y cuál era la última) y no un simple "ya está". Si aparece una
-- foto nueva, la firma deja de coincidir y el aviso vuelve solo. Es el mismo
-- criterio de `limpiezas.conflicto_resuelto`.
--
-- Es una tabla y no columnas en `limpiezas` porque son varias clases de
-- alerta sobre la misma limpieza (daño, olvido, arreglo) y van a ser más:
-- una columna por clase se convierte en una tabla ancha de banderas.

create table alerta_revisada (
  id uuid primary key default gen_random_uuid(),
  -- Qué clase de alerta se dio por revisada: 'huesped' | 'olvido'.
  clase text not null,
  limpieza_id uuid not null references limpiezas (id),
  -- Qué se revisó exactamente. Si cambia, la alerta reaparece.
  firma text not null,
  revisada_por uuid references personas (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Una sola marca por clase y limpieza: revisar de nuevo pisa la firma
  -- vieja, no acumula filas.
  unique (clase, limpieza_id)
);

comment on table alerta_revisada is
  'Alertas de fotos de limpieza que alguien ya miró. Guarda la firma de lo revisado: si la limpieza suma fotos nuevas, la alerta vuelve a aparecer.';

create index idx_alerta_revisada_limpieza on alerta_revisada (limpieza_id);

create trigger audit_alerta_revisada
  after insert or update or delete on alerta_revisada
  for each row execute function audit_trigger();

create trigger updated_at_alerta_revisada before update on alerta_revisada
  for each row execute function set_updated_at();

alter table alerta_revisada enable row level security;

-- Solo quien ve el panel de alertas puede dar algo por revisado: los mismos
-- tres roles que gatea `lib/alertas/permisos.ts`. El personal de limpieza y
-- la gobernanta cargan las fotos, no deciden si el tema está cerrado.
create policy alerta_revisada_back_office on alerta_revisada
  for all to authenticated
  using (mi_rol() in ('admin', 'manager', 'coordinador'))
  with check (mi_rol() in ('admin', 'manager', 'coordinador'));
