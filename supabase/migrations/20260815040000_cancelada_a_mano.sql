-- Una limpieza cancelada por una persona no la revive la importación.
--
-- QUÉ PASABA (14/08/2026, mismo día que lo de la fecha)
--
-- El planificador tiene una regla para revivir limpiezas canceladas: existe
-- para cuando una reserva descartada reaparece en el archivo de Airbnb y hay
-- que devolverle su limpieza.
--
-- Pero no distinguía quién la había cancelado. Si una persona la cancelaba a
-- propósito, la próxima importación la devolvía a pendiente.
--
-- Medido sobre ARENALES 9: la cancelaron 02:24, la importación de las 02:37
-- la revivió.
--
-- Es el mismo criterio que `fecha_manual`: lo que decide una persona no lo
-- pisa un recálculo. El caso legítimo —cancelada por el sistema porque la
-- reserva se fue— sigue funcionando, porque esas no llevan la marca.

alter table limpiezas
  add column cancelada_manual boolean not null default false;

comment on column limpiezas.cancelada_manual is
  'La canceló una persona, no el sistema. La importación no la revive.';
